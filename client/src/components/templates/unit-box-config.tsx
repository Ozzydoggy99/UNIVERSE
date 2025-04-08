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
    customUnitNumbers?: Record<number, number>; // Map of index -> custom unit number
  }>>({});

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
    
    // Add or update the custom unit number
    customUnitNumbers[unitIndex] = unitNumber;
    
    currentConfig.customUnitNumbers = customUnitNumbers;
    
    setUnsavedUnitConfig({
      ...unsavedUnitConfig,
      [componentIndex]: currentConfig
    });
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
                
                <div className="mt-2 p-2 bg-gray-100 rounded-md text-sm">
                  <p>Example: Floor 3 with start number {unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1}</p>
                  <p className="text-xs mt-1">First unit: {300 + (unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1)}</p>
                  <p className="text-xs mt-1">Last unit: {300 + (unsavedUnitConfig[index]?.unitStartNumber || component.unitStartNumber || 1) + (unsavedUnitConfig[index]?.unitsPerFloor || component.unitsPerFloor || 10) - 1}</p>
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
                        const unitIndex = prompt("Enter unit position (0-based index):", "0");
                        if (unitIndex !== null) {
                          const idx = parseInt(unitIndex);
                          if (!isNaN(idx) && idx >= 0) {
                            const customNumber = prompt("Enter custom unit number:", "");
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                      {Object.entries(unsavedUnitConfig[index]?.customUnitNumbers || component.customUnitNumbers || {}).map(([unitIdx, unitNum]: [string, any]) => (
                        <div key={unitIdx} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                          <div>
                            <span className="text-gray-500">Unit {unitIdx}:</span> {String(unitNum)}
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0 text-red-500"
                            onClick={() => {
                              // Remove custom unit number
                              const currentConfig = unsavedUnitConfig[index] ? { ...unsavedUnitConfig[index] } : {};
                              const customUnitNumbers = { ...(currentConfig.customUnitNumbers || component.customUnitNumbers || {}) };
                              delete customUnitNumbers[unitIdx];
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
                      ))}
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