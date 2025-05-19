import { ActionModule } from './action-modules';

export type SequenceStep = {
  actionId: string;
  params: Record<string, any>;
  description?: string;
};

export type WorkflowInput = {
  id: string;
  name: string;
  description: string;
  type: 'point' | 'number' | 'string' | 'boolean';
  required: boolean;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  inputs: WorkflowInput[];
  sequence: SequenceStep[];
};

/**
 * Zone-104 Workflow
 * Pick up a bin from the main pickup area and deliver it to Zone 104
 */
export const zoneToPickupWorkflow: WorkflowTemplate = {
  id: 'zone-104-workflow',
  name: 'Deliver to Zone 104',
  description: 'Pick up a bin from main pickup and deliver to Zone 104',
  inputs: [], // No dynamic inputs for this workflow yet
  sequence: [
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '050_load_docking',
        speed: 0.5
      },
      description: 'Move to pickup docking position'
    },
    {
      actionId: 'alignWithRack',
      params: {
        pointId: '050_load'
      },
      description: 'Align with rack at pickup'
    },
    {
      actionId: 'jackUp',
      params: {
        waitTime: 3000
      },
      description: 'Jack up to grab bin'
    },
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '104_load',
        speed: 0.5
      },
      description: 'Move directly to Zone 104 load point'
    },
    {
      actionId: 'jackDown',
      params: {
        waitTime: 3000
      },
      description: 'Jack down to release bin'
    },
    {
      actionId: 'returnToCharger',
      params: {
        maxRetries: 90
      },
      description: 'Return to charging station'
    }
  ]
};

/**
 * Pickup-to-104 Workflow
 * Pick up a bin from Zone 104 and deliver it to the main dropoff area
 */
export const pickupToDropoffWorkflow: WorkflowTemplate = {
  id: 'pickup-to-104-workflow',
  name: 'Pickup from Zone 104',
  description: 'Pick up a bin from Zone 104 and deliver to main dropoff',
  inputs: [], // No dynamic inputs for this workflow yet
  sequence: [
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '104_load_docking',
        speed: 0.5
      },
      description: 'Move to Zone 104 docking position'
    },
    {
      actionId: 'alignWithRack',
      params: {
        pointId: '104_load'
      },
      description: 'Align with rack at Zone 104'
    },
    {
      actionId: 'jackUp',
      params: {
        waitTime: 3000
      },
      description: 'Jack up to grab bin'
    },
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '001_load',
        speed: 0.5
      },
      description: 'Move directly to dropoff point'
    },
    {
      actionId: 'jackDown',
      params: {
        waitTime: 3000
      },
      description: 'Jack down to release bin'
    },
    {
      actionId: 'returnToCharger',
      params: {
        maxRetries: 90
      },
      description: 'Return to charging station'
    }
  ]
};

/**
 * Dynamic Shelf-to-Shelf Workflow
 * Pick up a bin from any shelf and deliver it to another shelf
 */
export const dynamicShelfToShelfWorkflow: WorkflowTemplate = {
  id: 'shelf-to-shelf',
  name: 'Shelf to Shelf Transport',
  description: 'Move a bin from one shelf to another shelf',
  inputs: [
    {
      id: 'pickupShelf',
      name: 'Pickup Shelf',
      description: 'Shelf where bin will be picked up',
      type: 'point',
      required: true
    },
    {
      id: 'dropoffShelf',
      name: 'Dropoff Shelf',
      description: 'Shelf where bin will be delivered',
      type: 'point',
      required: true
    }
  ],
  sequence: [
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '{pickupShelf}_load_docking',
        speed: 0.5
      },
      description: 'Move to pickup shelf docking position'
    },
    {
      actionId: 'alignWithRack',
      params: {
        pointId: '{pickupShelf}_load'
      },
      description: 'Align with rack at pickup shelf'
    },
    {
      actionId: 'jackUp',
      params: {
        waitTime: 3000
      },
      description: 'Jack up to grab bin'
    },
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '{dropoffShelf}_load',
        speed: 0.5
      },
      description: 'Move directly to dropoff shelf load point'
    },
    {
      actionId: 'jackDown',
      params: {
        waitTime: 3000
      },
      description: 'Jack down to release bin'
    },
    {
      actionId: 'returnToCharger',
      params: {
        maxRetries: 90
      },
      description: 'Return to charging station'
    }
  ]
};

/**
 * Dynamic Central-to-Shelf Workflow
 * Pick up a bin from central pickup and deliver to any shelf
 */
export const dynamicCentralToShelfWorkflow: WorkflowTemplate = {
  id: 'central-to-shelf',
  name: 'Central Pickup to Shelf',
  description: 'Move a bin from central pickup to any shelf',
  inputs: [
    {
      id: 'dropoffShelf',
      name: 'Dropoff Shelf',
      description: 'Shelf where bin will be delivered',
      type: 'point',
      required: true
    }
  ],
  sequence: [
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '050_load_docking',
        speed: 0.5
      },
      description: 'Move to central pickup docking position'
    },
    {
      actionId: 'alignWithRack',
      params: {
        pointId: '050_load'
      },
      description: 'Align with rack at central pickup'
    },
    {
      actionId: 'jackUp',
      params: {
        waitTime: 3000
      },
      description: 'Jack up to grab bin'
    },
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '{dropoffShelf}_load',
        speed: 0.5
      },
      description: 'Move directly to dropoff shelf load point'
    },
    {
      actionId: 'jackDown',
      params: {
        waitTime: 3000
      },
      description: 'Jack down to release bin'
    },
    {
      actionId: 'returnToCharger',
      params: {
        maxRetries: 90
      },
      description: 'Return to charging station'
    }
  ]
};

/**
 * Dynamic Shelf-to-Central Workflow
 * Pick up a bin from any shelf and deliver to central dropoff
 */
export const dynamicShelfToCentralWorkflow: WorkflowTemplate = {
  id: 'shelf-to-central',
  name: 'Shelf to Central Dropoff',
  description: 'Move a bin from any shelf to central dropoff',
  inputs: [
    {
      id: 'pickupShelf',
      name: 'Pickup Shelf',
      description: 'Shelf where bin will be picked up',
      type: 'point',
      required: true
    }
  ],
  sequence: [
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '{pickupShelf}_load_docking',
        speed: 0.5
      },
      description: 'Move to pickup shelf docking position'
    },
    {
      actionId: 'alignWithRack',
      params: {
        pointId: '{pickupShelf}_load'
      },
      description: 'Align with rack at pickup shelf'
    },
    {
      actionId: 'jackUp',
      params: {
        waitTime: 3000
      },
      description: 'Jack up to grab bin'
    },
    {
      actionId: 'moveToPoint',
      params: {
        pointId: '001_load',
        speed: 0.5
      },
      description: 'Move directly to central dropoff point'
    },
    {
      actionId: 'jackDown',
      params: {
        waitTime: 3000
      },
      description: 'Jack down to release bin'
    },
    {
      actionId: 'returnToCharger',
      params: {
        maxRetries: 90
      },
      description: 'Return to charging station'
    }
  ]
};

// Export all workflow templates in a single object for easy access
export const workflowTemplates = {
  'zone-104-workflow': zoneToPickupWorkflow,
  'pickup-to-104-workflow': pickupToDropoffWorkflow,
  'shelf-to-shelf': dynamicShelfToShelfWorkflow,
  'central-to-shelf': dynamicCentralToShelfWorkflow,
  'shelf-to-central': dynamicShelfToCentralWorkflow
};