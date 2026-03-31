import axios from 'axios';

// Constants for GHN (now using real env vars, no more mocks)
const GHN_API_URL = process.env.GHN_API_URL || 'https://dev-online-gateway.ghn.vn/shiip/public-api/v2';
const GHN_API_TOKEN = process.env.GHN_API_TOKEN || 'test_token';
// This assumes there is an env variable for shop ID. In practice GHN expects it as number
const GHN_SHOP_ID = process.env.GHN_SHOP_ID ? parseInt(process.env.GHN_SHOP_ID, 10) : 123456;

export class GhnService {
  private static readonly client = axios.create({
    baseURL: GHN_API_URL,
    headers: {
      'Token': GHN_API_TOKEN,
      'Content-Type': 'application/json',
      'ShopId': GHN_SHOP_ID
    }
  });

  /**
   * Calculate shipping fee using GHN API
   * Defaults to mock value if API call fails (for local development without real tokens)
   */
  static async calculateShippingFee(toDistrictId: number, toWardCode: string, weight: number = 200, length: number = 10, width: number = 10, height: number = 5): Promise<number> {
    try {
      if (!toDistrictId || !toWardCode) return 0;
      
      const response = await this.client.post('/shipping-order/fee', {
        service_type_id: 2, // 2: Standard, 1: Express
        to_district_id: toDistrictId,
        to_ward_code: toWardCode,
        weight,
        length,
        width,
        height,
      });

      if (response.data && response.data.code === 200) {
        return response.data.data.total;
      }
      return 0;
    } catch (error) {
      const errData = (error as any).response?.data;
      const ghnMessage = errData?.message || errData?.code_message_value || (error as any).message;
      console.error('GHN Calculate Fee Error:', errData || ghnMessage);
      throw new Error(`GHN không thể tính phí: ${ghnMessage}`);
    }
  }

  /**
   * Push order to GHN to get tracking number
   * Returns a mock tracking number if API fails
   */
  static async createShippingOrder(orderData: {
    orderId: string;
    toName: string;
    toPhone: string;
    toAddress: string;
    toWardCode: string;
    toDistrictId: number;
    weight?: number;
    items: { name: string; quantity: number; price: number }[];
    codAmount: number;
  }): Promise<string | null> {
    try {
      const payload = {
        payment_type_id: 1, // 1: Shop/Seller pays shipping
        note: `Đơn hàng ${orderData.orderId}`,
        required_note: "CHOXEMHANGKHONGTHU", 
        client_order_code: orderData.orderId,
        to_name: orderData.toName,
        to_phone: orderData.toPhone,
        to_address: orderData.toAddress,
        to_ward_code: orderData.toWardCode,
        to_district_id: orderData.toDistrictId,
        cod_amount: orderData.codAmount,
        weight: orderData.weight || 200,
        length: 15,
        width: 15,
        height: 10,
        service_type_id: 2,
        items: orderData.items,
      };

      const response = await this.client.post('/shipping-order/create', payload);

      if (response.data && response.data.code === 200) {
        return response.data.data.order_code; // Tracking number
      }
      return `MOCK_GHN_${Date.now()}`; 
    } catch (error) {
      const errData = (error as any).response?.data;
      const ghnMessage = errData?.message || errData?.code_message_value || (error as any).message;
      console.error('GHN Create Order Error:', errData || ghnMessage);
      throw new Error(`Thất bại: ${ghnMessage}`);
    }
  }
}
