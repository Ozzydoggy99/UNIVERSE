import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, X, Grid, ShowerHead, Trash } from 'lucide-react';

interface UnitBoxConfigProps {
  templateConfig: any;
  onSaveUnitConfig: (updates: any) => void;
}

export function UnitBoxConfig({ templateConfig, onSaveUnitConfig }: UnitBoxConfigProps) {
  // Unit box configuration state
  const [unsavedUnitConfig, setUnsavedUnitConfig] = useState<Record<number, {
    unitsPerFloor?: string | number;
    unitStartNumber?: string | number;
    customUnitNumbers?: Record<string, Record<number, number>>; // Map of floor -> (index -> custom unit number)
  }>>({});
  
  // State for preview floor selection
  const [previewFloor, setPreviewFloor] = useState(3);

  // Function to store and validate unit box configuration changes
  const storeUnitConfig = (index: number, field: 'unitsPerFloor' | 'unitStartNumber', value: string) => {
    const currentConfig = unsavedUnitConfig[index] ? { ...unsavedUnitConfig[index] } : {};
    
    if (value === '') {
      // Allow empty value for typing purposes
      currentConfig[field] = '';
    } else {
      // Convert to number and validate
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        // Different validation rules based on field type
        if (field === 'unitsPerFloor') {
          // Units per floor: 1-20
          currentConfig[field] = Math.max(1, Math.min(20, numValue));
        } else if (field === 'unitStartNumber') {
          // Unit start number: 1-99
          currentConfig[field] = Math.max(1, Math.min(99, numValue));
        }
      }
    }
    
    setUnsavedUnitConfig({
      ...unsavedUnitConfig,
      [index]: currentConfig
    });
  };
  
  // Function to set a custom unit number
  const setCustomUnitNumber = (componentIndex: number, unitIndex: number, unitNumber: number) => {
    const currentConfig = unsavedUnitConfig[componentIndex] ? { ...unsavedUnitConfig[componentIndex] } : {};
    const customUnitNumbers = currentConfig.customUnitNumbers || {};
    
    // Get the floor key as a string
    const floorKey = previewFloor.toString();
    
    // Ensure this floor has a unit map
    if (!customUnitNumbers[floorKey]) {
      customUnitNumbers[floorKey] = {};
    }
    
    // Add or update the custom unit number for this specific floor
    customUnitNumbers[floorKey][unitIndex] = unitNumber;
    
    currentConfig.customUnitNumbers = customUnitNumbers;
    
    setUnsavedUnitConfig({
      ...unsavedUnitConfig,
      [componentIndex]: currentConfig
    });
  };
  
  // Function to reset a custom unit number back to default
  const resetCustomUnitNumber = (componentIndex: number, unitIndex: number) => {
    const currentConfig = unsavedUnitConfig[componentIndex] ? { ...unsavedUnitConfig[componentIndex] } : {};
    const customUnitNumbers = currentConfig.customUnitNumbers || {};
    
    // Get the floor key as a string
    const floorKey = previewFloor.toString();
    
    // Ensure this floor has a unit map
    if (customUnitNumbers[floorKey] && customUnitNumbers[floorKey][unitIndex] !== undefined) {
      // Remove the custom unit number for this specific position
      const updatedFloorNumbers = { ...customUnitNumbers[floorKey] };
      delete updatedFloorNumbers[unitIndex];
      
      // If the floor has no more custom numbers, remove the entire floor entry
      if (Object.keys(updatedFloorNumbers).length === 0) {
        const updatedCustomNumbers = { ...customUnitNumbers };
        delete updatedCustomNumbers[floorKey];
        currentConfig.customUnitNumbers = updatedCustomNumbers;
      } else {
        // Otherwise update the floor with remaining custom numbers
        customUnitNumbers[floorKey] = updatedFloorNumbers;
        currentConfig.customUnitNumbers = customUnitNumbers;
      }
      
      setUnsavedUnitConfig({
        ...unsavedUnitConfig,
        [componentIndex]: currentConfig
      });
    }
  };
  
  // Function to reset all custom unit numbers for a floor
  const resetFloorCustomUnitNumbers = (componentIndex: number) => {
    const currentConfig = unsavedUnitConfig[componentIndex] ? { ...unsavedUnitConfig[componentIndex] } : {};
    const customUnitNumbers = currentConfig.customUnitNumbers || {};
    
    // Get the floor key as a string
    const floorKey = previewFloor.toString();
    
    // Remove the entire floor entry if it exists
    if (customUnitNumbers[floorKey]) {
      const updatedCustomNumbers = { ...customUnitNumbers };
      delete updatedCustomNumbers[floorKey];
      currentConfig.customUnitNumbers = updatedCustomNumbers;
      
      setUnsavedUnitConfig({
        ...unsavedUnitConfig,
        [componentIndex]: currentConfig
      });
    }
  };
  
  // Function to save all unit box configuration changes
  const saveUnitConfigChanges = () => {
    if (Object.keys(unsavedUnitConfig).length === 0) return;
    
    const updatedConfig = { ...templateConfig };
    
    // Apply all unsaved unit configuration changes
    Object.entries(unsavedUnitConfig).forEach(([indexStr, config]) => {
      const index = parseInt(indexStr);
      if (updatedConfig.components[index]) {
        const currentComponent = { ...updatedConfig.components[index] };
        
        // Process unitsPerFloor field
        if (config.unitsPerFloor !== undefined) {
          let unitsValue = 10; // Default value
          if (typeof config.unitsPerFloor === 'string') {
            unitsValue = config.unitsPerFloor === '' ? 10 : parseInt(config.unitsPerFloor) || 10;
          } else {
            unitsValue = config.unitsPerFloor as number;
          }
          currentComponent.unitsPerFloor = Math.max(1, Math.min(20, unitsValue));
        }
        
        // Process unitStartNumber field
        if (config.unitStartNumber !== undefined) {
          let startValue = 1; // Default value
          if (typeof config.unitStartNumber === 'string') {
            startValue = config.unitStartNumber === '' ? 1 : parseInt(config.unitStartNumber) || 1;
          } else {
            startValue = config.unitStartNumber as number;
          }
          currentComponent.unitStartNumber = Math.max(1, Math.min(99, startValue));
        }
        
        // Process customUnitNumbers field
        if (config.customUnitNumbers) {
          currentComponent.customUnitNumbers = config.customUnitNumbers;
        }
        
        updatedConfig.components[index] = currentComponent;
      }
    });
    
    // Call the parent save function
    onSaveUnitConfig(updatedConfig);
    
    // Clear unsaved unit configs after successful update
    setUnsavedUnitConfig({});
  };

  return (
    <Card className="p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Grid className="h-5 w-5 mr-2 text-primary" />
        Unit Box Configuration
      </h3>
      
      <div className="space-y-4">
        {templateConfig.components.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border rounded-md">
            <p>No components in this template.</p>
            <p className="text-xs mt-1">Edit the template to add components</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templateConfig.components.map((component: any, index: number) => (
              <div key={index} className="flex flex-col p-3 bg-gray-50 rounded-md border relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: component.color}}>
                    {component.icon === 'laundry' ? (
                      <ShowerHead className="h-5 w-5 text-white" />
                    ) : (
                      <Trash className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {component.icon && (component.icon.charAt(0).toUpperCase() + component.icon.slice(1))} Unit Configuration
                    </div>
                    <div className="text-xs text-gray-500">
                      Customize the final unit selection screen
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                  <div>
                    <Label htmlFor={`units-per-floor-${index}`} className="mb-2 block text-sm">
                      Units Per Floor
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`units-per-floor-${index}`}
                        type="number"
                        className="w-full"
                        min="1"
                        max="20"
                        value={
                          unsavedUnitConfig[index]?.unitsPerFloor !== undefined 
                            ? unsavedUnitConfig[index].unitsPerFloor 
                            : component.unitsPerFloor || 10
                        }
                        onChange={(e) => storeUnitConfig(index, 'unitsPerFloor', e.target.value)}
                      />
                      <Button 
                        size="sm"
                        variant="outline"
                        className="px-2 text-xs whitespace-nowrap"
                        onClick={() => {
                          const currentValue = unsavedUnitConfig[index]?.unitsPerFloor !== undefined 
                            ? unsavedUnitConfig[index].unitsPerFloor 
                            : component.unitsPerFloor || 10;
                          const value = prompt("Enter exact number of units per floor (1-20):", currentValue.toString());
                          if (value) {
                            storeUnitConfig(index, 'unitsPerFloor', value);
                          }
                        }}
                      >
                        Set Exact
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Number of unit boxes shown (1-20)</p>
                    {unsavedUnitConfig[index]?.unitsPerFloor !== undefined && 
                      <p className="text-xs text-amber-500 mt-1">Unsaved changes</p>
                    }
                  </div>
                  
                  <div>
                    <Label htmlFor={`unit-start-number-${index}`} className="mb-2 block text-sm">
                      Unit Start Number
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`unit-start-number-${index}`}
                        type="number"
                        className="w-full"
                        min="1"
                        max="99"
                        value={
                          unsavedUnitConfig[index]?.unitStartNumber !== undefined 
                            ? unsavedUnitConfig[index].unitStartNumber 
                            : component.unitStartNumber || 1
                        }
                        onChange={(e) => storeUnitConfig(index, 'unitStartNumber', e.target.value)}
                      />
                      <Button 
                        size="sm"
                        variant="outline"
                        className="px-2 text-xs whitespace-nowrap"
                        onClick={() => {
                          const currentValue = unsavedUnitConfig[index]?.unitStartNumber !== undefined 
                            ? unsavedUnitConfig[index].unitStartNumber 
                            : component.unitStartNumber || 1;
                          const value = prompt("Enter exact start unit number (1-99):", currentValue.toString());
                          if (value) {
                            storeUnitConfig(index, 'unitStartNumber', value);
                          }
                        }}
                      >
                        Set Exact
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Starting unit number (1-99)</p>
                    {unsavedUnitConfig[index]?.unitStartNumber !== undefined && 
                      <p className="text-xs text-amber-500 mt-1">Unsaved changes</p>
                    }
                  </div>
                </div>
                
                <div className="mt-2 border-t pt-3">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <h4 className="font-medium text-sm mr-3">Preview</h4>
                      <select 
                        className="border rounded px-2 py-1 text-sm bg-white"
                        value={previewFloor}
                        onChange={(e) => setPreviewFloor(parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((floor) => (
                          <option key={floor} value={floor}>Floor {floor}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-7"
                        onClick={() => {
                          // Get current box with focus or default to last
                          const unitIndex = prompt("Enter unit position to edit (0-based index):", "0");
                          if (unitIndex !== null) {
                            const idx = parseInt(unitIndex);
                            if (!isNaN(idx) && idx >= 0 && idx < (unsavedUnitConfig[index]?.unitsPerFloor || component.unitsPerFloor || 10)) {
                              const unitStartNumber = unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1;
                              const baseUnitNumber = previewFloor * 100 + unitStartNumber;
                              
                              // Get current value to show in prompt
                              const floorKey = previewFloor.toString();
                              const customNumbers = unsavedUnitConfig[index]?.customUnitNumbers || component.customUnitNumbers || {};
                              const floorCustomNumbers = customNumbers[floorKey] || {};
                              const currentValue = floorCustomNumbers[idx] !== undefined ? floorCustomNumbers[idx] : (baseUnitNumber + idx);
                              
                              const customNumber = prompt(`Set custom number for unit position ${idx} on floor ${previewFloor}:`, currentValue.toString());
                              if (customNumber !== null) {
                                const num = parseInt(customNumber);
                                if (!isNaN(num)) {
                                  setCustomUnitNumber(index, idx, num);
                                }
                              }
                            }
                          }
                        }}
                      >
                        Edit By Position
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="text-xs h-7"
                        onClick={() => {
                          const floorKey = previewFloor.toString();
                          const customNumbers = unsavedUnitConfig[index]?.customUnitNumbers || component.customUnitNumbers || {};
                          const floorCustomNumbers = customNumbers[floorKey] || {};
                          
                          // Only show reset button if there are custom numbers to reset
                          if (Object.keys(floorCustomNumbers).length > 0) {
                            if (window.confirm(`Reset all custom unit numbers on floor ${previewFloor}?`)) {
                              resetFloorCustomUnitNumbers(index);
                            }
                          } else {
                            alert(`No custom unit numbers on floor ${previewFloor} to reset.`);
                          }
                        }}
                      >
                        Reset Floor
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 max-h-[300px] overflow-y-auto p-2 border rounded-md bg-gray-50">
                    {Array.from({ length: (unsavedUnitConfig[index]?.unitsPerFloor || component.unitsPerFloor || 10) }).map((_, unitIdx) => {
                      // Calculate unit number based on customization or default formula
                      const unitStartNumber = unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1;
                      const baseUnitNumber = previewFloor * 100 + unitStartNumber;
                      
                      // Use custom unit number if available, otherwise calculate standard unit number
                      const floorKey = previewFloor.toString();
                      const customNumbers = unsavedUnitConfig[index]?.customUnitNumbers || component.customUnitNumbers || {};
                      const floorCustomNumbers = customNumbers[floorKey] || {};
                      const displayNumber = floorCustomNumbers[unitIdx] !== undefined ? floorCustomNumbers[unitIdx] : (baseUnitNumber + unitIdx);
                      const isCustom = floorCustomNumbers[unitIdx] !== undefined;
                      
                      return (
                        <div 
                          key={unitIdx} 
                          className={`aspect-square rounded-lg relative flex items-center justify-center overflow-hidden shadow-md cursor-pointer transform transition-all hover:translate-y-[-2px] hover:shadow-lg
                                    ${isCustom ? 'bg-indigo-600 text-white border-2 border-indigo-700' : 'bg-black text-white border border-gray-700'}`}
                          onClick={() => {
                            // Allow clicking to set custom unit number
                            const customNumber = prompt(`Set custom number for unit position ${unitIdx} on floor ${previewFloor}:`, displayNumber.toString());
                            if (customNumber) {
                              const numValue = parseInt(customNumber);
                              if (!isNaN(numValue)) {
                                setCustomUnitNumber(index, unitIdx, numValue);
                              }
                            }
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // Show context menu with reset option
                            if (isCustom) {
                              if (window.confirm(`Reset custom number for unit position ${unitIdx} on floor ${previewFloor}?`)) {
                                resetCustomUnitNumber(index, unitIdx);
                              }
                            } else {
                              alert('This unit already uses the default numbering system.');
                            }
                          }}
                        >
                          <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none"></div>
                          <div className={`font-bold text-lg tracking-wide px-3 py-2 rounded-md shadow-inner border border-white/10
                                         ${isCustom ? 'bg-indigo-700' : 'bg-white/10'}`}>
                            {displayNumber}
                          </div>
                          {isCustom && (
                            <div className="absolute top-1 right-1 bg-indigo-500 rounded-full h-3 w-3 shadow"></div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-t from-white/10 to-transparent"></div>
                          <div className="absolute top-0 left-1 text-xs text-white/70">{unitIdx}</div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="p-2 bg-gray-100 rounded-md text-sm">
                    <p>Floor {previewFloor} with start number {unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1}</p>
                    <p className="text-xs mt-1">First unit: {previewFloor * 100 + (unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1)}</p>
                    <p className="text-xs mt-1">Last unit: {previewFloor * 100 + (unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1) + (unsavedUnitConfig[index]?.unitsPerFloor || component.unitsPerFloor || 10) - 1}</p>
                    <div className="flex items-center mt-2 text-xs">
                      <div className="h-3 w-3 bg-indigo-500 rounded-full mr-2"></div>
                      <span className="italic text-indigo-800">Units with a blue dot have custom numbering</span>
                    </div>
                    <p className="text-xs mt-1 italic">Click on any box above to set a custom unit number. Right-click to reset a custom number.</p>
                  </div>
                </div>
                
                {/* Custom Unit Numbers Section */}
                <div className="mt-4 border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Custom Unit Numbers</h4>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs"
                      onClick={() => {
                        const unitIndex = prompt(`Enter unit position (0-based index) for floor ${previewFloor}:`, "0");
                        if (unitIndex !== null) {
                          const idx = parseInt(unitIndex);
                          if (!isNaN(idx) && idx >= 0) {
                            const unitStartNumber = unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1;
                            const baseUnitNumber = previewFloor * 100 + unitStartNumber + idx;
                            
                            const customNumber = prompt(`Enter custom unit number for position ${idx} on floor ${previewFloor}:`, baseUnitNumber.toString());
                            if (customNumber !== null) {
                              const num = parseInt(customNumber);
                              if (!isNaN(num)) {
                                setCustomUnitNumber(index, idx, num);
                              }
                            }
                          }
                        }
                      }}
                    >
                      Add Custom Unit Number
                    </Button>
                  </div>
                  
                  {/* Display existing custom unit numbers */}
                  {unsavedUnitConfig[index]?.customUnitNumbers || component.customUnitNumbers ? (
                    <div>
                      <div className="mb-3">
                        <select 
                          className="border rounded px-2 py-1 text-sm bg-white w-full"
                          value={previewFloor}
                          onChange={(e) => setPreviewFloor(parseInt(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((floor) => (
                            <option key={floor} value={floor}>Floor {floor} Custom Numbers</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {/* Show only the custom unit numbers for the current floor */}
                        {(() => {
                          const customNumbers = unsavedUnitConfig[index]?.customUnitNumbers || component.customUnitNumbers || {};
                          const floorKey = previewFloor.toString();
                          const floorCustomNumbers = customNumbers[floorKey] || {};
                          
                          if (Object.keys(floorCustomNumbers).length === 0) {
                            return (
                              <div className="col-span-full text-xs text-gray-500 mt-1 p-2 bg-gray-50 rounded">
                                No custom unit numbers set for Floor {previewFloor}.
                              </div>
                            );
                          }
                          
                          return Object.entries(floorCustomNumbers).map(([unitIdx, unitNum]: [string, any]) => (
                            <div key={unitIdx} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                              <div>
                                <span className="text-gray-500">Position {unitIdx}:</span> {String(unitNum)}
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-red-500"
                                onClick={() => {
                                  // Remove custom unit number for specific floor
                                  const currentConfig = unsavedUnitConfig[index] ? { ...unsavedUnitConfig[index] } : {};
                                  const customUnitNumbers = { ...(currentConfig.customUnitNumbers || component.customUnitNumbers || {}) };
                                  const floorNumbers = { ...(customUnitNumbers[floorKey] || {}) };
                                  
                                  delete floorNumbers[unitIdx];
                                  
                                  // If this floor has no more custom numbers, remove the floor entry
                                  if (Object.keys(floorNumbers).length === 0) {
                                    delete customUnitNumbers[floorKey];
                                  } else {
                                    customUnitNumbers[floorKey] = floorNumbers;
                                  }
                                  
                                  currentConfig.customUnitNumbers = customUnitNumbers;
                                  setUnsavedUnitConfig({
                                    ...unsavedUnitConfig,
                                    [index]: currentConfig
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 mt-1">
                      No custom unit numbers set. By default, unit numbers will follow sequence.
                    </div>
                  )}
                  
                  {unsavedUnitConfig[index]?.customUnitNumbers && 
                    <p className="text-xs text-amber-500 mt-2">Unsaved custom unit number changes</p>
                  }
                </div>
                
                {(unsavedUnitConfig[index]?.unitsPerFloor !== undefined || 
                  unsavedUnitConfig[index]?.unitStartNumber !== undefined) && (
                  <Button 
                    size="sm" 
                    className="absolute top-2 right-2" 
                    variant="ghost"
                    onClick={() => {
                      const newUnsavedConfig = { ...unsavedUnitConfig };
                      delete newUnsavedConfig[index];
                      setUnsavedUnitConfig(newUnsavedConfig);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            
            {Object.keys(unsavedUnitConfig).length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="default"
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={saveUnitConfigChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save All Unit Box Changes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}