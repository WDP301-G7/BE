import dotenv from 'dotenv';
dotenv.config();

import { GhnService } from './src/integrations/ghn/ghn.service';

async function testGhn() {
    console.log('Testing GHN API Connection...');
    console.log('Token exists:', !!process.env.GHN_API_TOKEN);
    console.log('Shop ID:', process.env.GHN_SHOP_ID);
    
    try {
        // District 1452 (Thủ Đức, HCM), Ward 21012
        console.log('Calculating fee...');
        const fee = await GhnService.calculateShippingFee(1452, "21012", 200);
        console.log('Shipping Fee Success! Fee:', fee);
    } catch (e: any) {
        console.error('Test Failed:', e.message);
    }
}

testGhn();
