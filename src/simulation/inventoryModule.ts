/**
 * Inventory Module - Handles raw material ordering and management with type safety
 * Manages inventory levels, reorder points, and order processing
 */

import type { SimulationState, Strategy, RawMaterialOrder } from './types.js';
import { CONSTANTS } from './constants.js';

export interface OrderDetails {
  orderDay: number;
  quantity: number;
  unitCost: number;
  orderFee: number;
  totalCost: number;
  arrivalDay: number;
  leadTime: number;
}

export interface MaterialConsumption {
  requested: number;
  consumed: number;
  remaining: number;
  shortfall: number;
  productionLine: 'standard' | 'custom';
}

export interface InventoryStatus {
  currentInventory: number;
  pendingOrders: number;
  pendingQuantity: number;
  totalCommitted: number;
  inventoryValue: number;
  reorderPoint: number;
  orderQuantity: number;
  belowReorderPoint: boolean;
  daysUntilReorder: number;
  nextArrival: number | null;
}

export interface InventoryProjection {
  standardNeeds: number;
  customNeeds: number;
  totalNeeds: number;
  currentInventory: number;
  pendingQuantity: number;
  totalAvailable: number;
  surplus: number;
  canMeetDemand: boolean;
  shortfall: number;
}

export interface OrderHistoryItem extends RawMaterialOrder {
  status: 'ARRIVED' | 'PENDING';
  daysUntilArrival: number;
}

/**
 * Places an order for raw materials
 */
export function orderRawMaterials(state: SimulationState, quantity: number): OrderDetails {
  const orderCost = quantity * CONSTANTS.RAW_MATERIAL_UNIT_COST + CONSTANTS.RAW_MATERIAL_ORDER_FEE;
  const arrivalDay = state.currentDay + CONSTANTS.RAW_MATERIAL_LEAD_TIME;

  // Deduct cost from cash
  state.cash -= orderCost;

  // Add to pending orders
  state.pendingRawMaterialOrders.push({
    orderDay: state.currentDay,
    quantity,
    arrivalDay,
    cost: orderCost,
  });

  return {
    orderDay: state.currentDay,
    quantity,
    unitCost: CONSTANTS.RAW_MATERIAL_UNIT_COST,
    orderFee: CONSTANTS.RAW_MATERIAL_ORDER_FEE,
    totalCost: orderCost,
    arrivalDay,
    leadTime: CONSTANTS.RAW_MATERIAL_LEAD_TIME,
  };
}

/**
 * Processes arriving raw material orders
 */
export function processArrivingOrders(state: SimulationState): RawMaterialOrder[] {
  const arrivingOrders: RawMaterialOrder[] = [];

  state.pendingRawMaterialOrders = state.pendingRawMaterialOrders.filter((order) => {
    if (order.arrivalDay <= state.currentDay) {
      // Order has arrived
      state.rawMaterialInventory += order.quantity;
      arrivingOrders.push(order);
      return false; // Remove from pending
    }
    return true; // Keep in pending
  });

  return arrivingOrders;
}

/**
 * Checks if inventory is below reorder point and places order if needed
 */
export function checkAndReorder(state: SimulationState, strategy: Strategy): OrderDetails | null {
  const { reorderPoint, orderQuantity } = strategy;

  // Check if we have enough cash for the order
  const orderCost = orderQuantity * CONSTANTS.RAW_MATERIAL_UNIT_COST + CONSTANTS.RAW_MATERIAL_ORDER_FEE;

  // Check if inventory is below reorder point and we have cash
  if (state.rawMaterialInventory <= reorderPoint && state.cash >= orderCost) {
    return orderRawMaterials(state, orderQuantity);
  }

  return null;
}

/**
 * Consumes raw materials from inventory for production
 */
export function consumeRawMaterials(
  state: SimulationState,
  quantity: number,
  productionLine: 'standard' | 'custom'
): MaterialConsumption {
  const available = state.rawMaterialInventory;
  const consumed = Math.min(quantity, available);

  state.rawMaterialInventory -= consumed;

  return {
    requested: quantity,
    consumed,
    remaining: state.rawMaterialInventory,
    shortfall: quantity - consumed,
    productionLine,
  };
}

/**
 * Gets inventory status and metrics
 */
export function getInventoryStatus(state: SimulationState, strategy: Strategy): InventoryStatus {
  const { reorderPoint, orderQuantity } = strategy;
  const pendingQuantity = state.pendingRawMaterialOrders.reduce((sum, order) => sum + order.quantity, 0);

  const inventoryValue = state.rawMaterialInventory * CONSTANTS.RAW_MATERIAL_UNIT_COST;
  const daysUntilReorder =
    state.rawMaterialInventory > reorderPoint ? state.rawMaterialInventory - reorderPoint : 0;

  return {
    currentInventory: state.rawMaterialInventory,
    pendingOrders: state.pendingRawMaterialOrders.length,
    pendingQuantity,
    totalCommitted: state.rawMaterialInventory + pendingQuantity,
    inventoryValue,
    reorderPoint,
    orderQuantity,
    belowReorderPoint: state.rawMaterialInventory <= reorderPoint,
    daysUntilReorder,
    nextArrival:
      state.pendingRawMaterialOrders.length > 0 ? state.pendingRawMaterialOrders[0].arrivalDay : null,
  };
}

/**
 * Calculates projected inventory needs based on production plans
 */
export function projectInventoryNeeds(
  state: SimulationState,
  projectedStandardProduction: number,
  projectedCustomProduction: number
): InventoryProjection {
  const standardNeeds = projectedStandardProduction * CONSTANTS.STANDARD_RAW_MATERIAL_PER_UNIT;
  const customNeeds = projectedCustomProduction * CONSTANTS.CUSTOM_RAW_MATERIAL_PER_UNIT;
  const totalNeeds = standardNeeds + customNeeds;

  const currentInventory = state.rawMaterialInventory;
  const pendingQuantity = state.pendingRawMaterialOrders.reduce((sum, order) => sum + order.quantity, 0);
  const totalAvailable = currentInventory + pendingQuantity;

  return {
    standardNeeds,
    customNeeds,
    totalNeeds,
    currentInventory,
    pendingQuantity,
    totalAvailable,
    surplus: totalAvailable - totalNeeds,
    canMeetDemand: totalAvailable >= totalNeeds,
    shortfall: Math.max(0, totalNeeds - totalAvailable),
  };
}

/**
 * Gets detailed order history for analysis
 */
export function getOrderHistory(state: SimulationState): OrderHistoryItem[] {
  return state.pendingRawMaterialOrders.map((order) => ({
    ...order,
    status: (order.arrivalDay <= state.currentDay ? 'ARRIVED' : 'PENDING') as 'ARRIVED' | 'PENDING',
    daysUntilArrival: Math.max(0, order.arrivalDay - state.currentDay),
  }));
}
