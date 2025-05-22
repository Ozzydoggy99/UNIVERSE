# Test script for bin alignment and pickup at 050_load
# Assumes robot is already at 050_load_docking with jack down

Write-Host "DEBUG: Script starting..." -ForegroundColor Cyan
Write-Host "DEBUG: Testing connection to robot..." -ForegroundColor Cyan

# Test robot connection first
try {
    $testResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/status" -Method Get
    Write-Host "DEBUG: Robot connection successful. State: $($testResponse | ConvertTo-Json)" -ForegroundColor Green
    
    # Check and set control mode to auto
    if ($testResponse.control_mode -ne "auto") {
        Write-Host "Switching robot to auto mode..." -ForegroundColor Yellow
        $controlBody = @{
            control_mode = "auto"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/status" -Method Patch -ContentType "application/json" -Body $controlBody
        Write-Host "✅ Robot switched to auto mode" -ForegroundColor Green
    }
} catch {
    Write-Host "DEBUG: Failed to connect to robot: $_" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Starting bin alignment and pickup test at 050_load" -ForegroundColor Green

# Helper function to check move status
function Check-MoveStatus {
    param (
        [string]$moveId
    )
    try {
        $statusResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves/$moveId" -Method Get
        if ($statusResponse -and $statusResponse.state) {
            return $statusResponse.state
        }
        return "unknown"
    } catch {
        Write-Host "Error checking move status: $_"
        return "failed"
    }
}

# Helper function to wait for move completion
function Wait-ForMoveComplete {
    param (
        [string]$moveId,
        [int]$Timeout = 120000  # 2 minutes timeout
    )
    
    $startTime = Get-Date
    $isMoving = $true
    
    while ($isMoving -and ((Get-Date) - $startTime).TotalMilliseconds -lt $Timeout) {
        $status = Check-MoveStatus -moveId $moveId
        Write-Host "Current move status: $status"
        
        if ($status -eq "succeeded") {
            $isMoving = $false
            Write-Host "✅ Move completed successfully"
        } elseif ($status -eq "failed" -or $status -eq "cancelled") {
            throw "Move failed with status: $status"
        } else {
            Start-Sleep -Seconds 1
        }
    }
    
    if ($isMoving) {
        throw "Move timed out after $Timeout ms"
    }
}

# Helper function to check jack state
function Check-JackState {
    try {
        $jackStateResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/services/jack_state" -Method Get
        Write-Host "Full jack state response: $($jackStateResponse | ConvertTo-Json)"
        if ($jackStateResponse -and $jackStateResponse.state -ne $null) {
            return $jackStateResponse.state
        }
        return $null
    } catch {
        Write-Host "Error checking jack state: $_"
        return $null
    }
}

# Helper function to wait for jack operation
function Wait-ForJackOperation {
    param (
        [string]$targetState,  # "up" or "down"
        [int]$Timeout = 20000  # 20 seconds timeout
    )
    
    $startTime = Get-Date
    $isComplete = $false
    
    while (-not $isComplete -and ((Get-Date) - $startTime).TotalMilliseconds -lt $Timeout) {
        $jackState = Check-JackState
        if ($jackState -ne $null) {
            Write-Host "Current jack state: $jackState"
            if ($jackState -eq $targetState) {
                $isComplete = $true
                Write-Host "✅ Jack operation completed successfully"
            }
        }
        if (-not $isComplete) {
            Start-Sleep -Seconds 1
        }
    }
    
    if (-not $isComplete) {
        throw "Jack operation timed out after $Timeout ms"
    }
}

# Step 0: Move to 050_load_docking
Write-Host "`nStep 0: Moving to 050_load_docking..." -ForegroundColor Yellow
try {
    $moveBody = @{
        type = "standard"
        target_x = -1.887
        target_y = 2.311
        target_z = 0
        target_ori = 0
        creator = "test"
        properties = @{
            max_trans_vel = 0.5
            max_rot_vel = 0.5
            acc_lim_x = 0.5
            acc_lim_theta = 0.5
            planning_mode = "directional"
        }
    } | ConvertTo-Json
    $moveResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves" -Method Post -ContentType "application/json" -Body $moveBody
    
    if ($moveResponse -and $moveResponse.id) {
        Write-Host "✅ Move command sent successfully (ID: $($moveResponse.id))"
        Wait-ForMoveComplete -moveId $moveResponse.id
    } else {
        Write-Host "❌ Failed to move to 050_load_docking: No move ID in response"
        exit 1
    }
} catch {
    Write-Host "❌ Error during move to 050_load_docking: $_" -ForegroundColor Red
    exit 1
}

# Step 1: Align with rack
Write-Host "`nStep 1: Aligning with rack at 050_load..." -ForegroundColor Yellow
try {
    # Wait for stabilization
    Write-Host "Waiting for robot to stabilize..."
    Start-Sleep -Seconds 2
    
    $alignBody = @{
        type = "align_with_rack"
        target_x = -2.847
        target_y = 2.311
        target_z = 0
        target_ori = 0
        creator = "test"
        point_id = "050_load"  # Using load point without _docking suffix
    } | ConvertTo-Json
    $alignResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves" -Method Post -ContentType "application/json" -Body $alignBody
    
    if ($alignResponse -and $alignResponse.id) {
        Write-Host "✅ Alignment command sent successfully (ID: $($alignResponse.id))"
        Wait-ForMoveComplete -moveId $alignResponse.id
    } else {
        Write-Host "❌ Failed to align with rack: No move ID in response"
        exit 1
    }
} catch {
    Write-Host "❌ Error during alignment: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Pick up bin
Write-Host "`nStep 2: Picking up bin..." -ForegroundColor Yellow
try {
    Write-Host "Sending jack up command..."
    $pickupResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/services/jack_up" -Method Post -ContentType "application/json" -Body "{}"
    Write-Host "✅ Jack up command sent"
    Write-Host "Waiting for jack to complete..."
    Start-Sleep -Seconds 10  # Wait 10 seconds for jack to complete
} catch {
    Write-Host "❌ Error during bin pickup: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Jack up
Write-Host "`nStep 3: Jacking up..." -ForegroundColor Yellow
try {
    $jackBody = @{
        type = "standard"
        target_x = -2.847
        target_y = 2.311
        target_z = 0.2
        target_ori = 0
        creator = "test"
        speed = 0.1
    } | ConvertTo-Json
    $jackResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves" -Method Post -ContentType "application/json" -Body $jackBody
    
    if ($jackResponse -and $jackResponse.id) {
        Write-Host "✅ Jack up command sent successfully (ID: $($jackResponse.id))"
        Wait-ForMoveComplete -moveId $jackResponse.id
    } else {
        Write-Host "❌ Failed to jack up: No move ID in response"
        exit 1
    }
} catch {
    Write-Host "❌ Error during jack up: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Move to 110_load_docking
Write-Host "`nStep 4: Moving to 110_load_docking..." -ForegroundColor Yellow
try {
    $moveBody = @{
        type = "standard"
        target_x = -5.660  # Correct coordinates from terminal output
        target_y = 14.52
        target_z = 0.2
        target_ori = 271.07
        creator = "test"
        properties = @{
            max_trans_vel = 0.5
            max_rot_vel = 0.5
            acc_lim_x = 0.5
            acc_lim_theta = 0.5
            planning_mode = "directional"
        }
        point_id = "110_load_docking"
    } | ConvertTo-Json
    $moveResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves" -Method Post -ContentType "application/json" -Body $moveBody
    
    if ($moveResponse -and $moveResponse.id) {
        Write-Host "✅ Move command sent successfully (ID: $($moveResponse.id))"
        Wait-ForMoveComplete -moveId $moveResponse.id
    } else {
        Write-Host "❌ Failed to move: No move ID in response"
        exit 1
    }
} catch {
    Write-Host "❌ Error during move: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Unload bin using to_unload_point
Write-Host "`nStep 5: Unloading bin..." -ForegroundColor Yellow
try {
    $unloadBody = @{
        type = "to_unload_point"
        target_x = -5.68766632312645  # Original coordinates for 110_load
        target_y = 15.347413058037773
        target_z = 0.2
        target_ori = 271.07
        creator = "test"
        point_id = "110_load"
    } | ConvertTo-Json
    $unloadResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves" -Method Post -ContentType "application/json" -Body $unloadBody
    
    if ($unloadResponse -and $unloadResponse.id) {
        Write-Host "✅ Unload command sent successfully (ID: $($unloadResponse.id))"
        Wait-ForMoveComplete -moveId $unloadResponse.id
    } else {
        Write-Host "❌ Failed to unload: No move ID in response"
        exit 1
    }
} catch {
    Write-Host "❌ Error during bin unload: $_" -ForegroundColor Red
    exit 1
}

# Step 6: Jack down
Write-Host "`nStep 6: Jacking down..." -ForegroundColor Yellow
try {
    Write-Host "Sending jack down command..."
    $jackDownResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/services/jack_down" -Method Post -ContentType "application/json" -Body "{}"
    Write-Host "✅ Jack down command sent"
    Write-Host "Waiting for jack to complete..."
    Start-Sleep -Seconds 10  # Wait 10 seconds for jack to complete
} catch {
    Write-Host "❌ Error during jack down: $_" -ForegroundColor Red
    exit 1
}

# Step 7: Return to charger
Write-Host "`nStep 7: Returning to charger..." -ForegroundColor Yellow
try {
    $chargerBody = @{
        type = "charge"  # Correct move type for charger docking
        target_x = 0.03443853667262486  # Known charger coordinates
        target_y = 0.4981316698765672
        target_z = 0
        target_ori = 266.11
        target_accuracy = 0.05  # 5cm accuracy required for docking
        charge_retry_count = 5  # Allow up to 5 retry attempts
        creator = "test"
        properties = @{
            max_trans_vel = 0.2  # Slower speed for more accurate docking
            max_rot_vel = 0.2
            acc_lim_x = 0.2
            acc_lim_theta = 0.2
            planning_mode = "directional"
        }
        point_id = "Charging Station_docking"
    } | ConvertTo-Json
    $chargerResponse = Invoke-RestMethod -Uri "http://192.168.4.31:8090/chassis/moves" -Method Post -ContentType "application/json" -Body $chargerBody
    
    if ($chargerResponse -and $chargerResponse.id) {
        Write-Host "✅ Return to charger command sent successfully (ID: $($chargerResponse.id))"
        Wait-ForMoveComplete -moveId $chargerResponse.id
    } else {
        Write-Host "❌ Failed to return to charger: No move ID in response"
        exit 1
    }
} catch {
    Write-Host "❌ Error during return to charger: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Test completed successfully!" -ForegroundColor Green 