export default async function handler(req, res) {
  // Hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }
  
  const { bookingId, amount, customerName, customerEmail, customerPhone, fieldName } = req.body

  // Server Key dari Midtrans Sandbox
  const serverKey = 'Mid-server-YoE1hinFoaikHLPdyzX2q_aU'
  const base64Key = Buffer.from(serverKey + ':').toString('base64')

  const payload = {
    transaction_details: {
      order_id: bookingId + '-' + Date.now(), // Tambah timestamp agar order_id unik saat retry
      gross_amount: amount
    },
    credit_card: { secure: true },
    customer_details: {
      first_name: customerName || 'Customer',
      email: customerEmail || 'customer@example.com',
      phone: customerPhone || '-'
    },
    item_details: [{
      id: bookingId,
      price: amount,
      quantity: 1,
      name: fieldName || 'Sewa Lapangan'
    }]
  }

  try {
    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${base64Key}`
      },
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    if (data.token) {
      res.status(200).json({ token: data.token })
    } else {
      res.status(400).json({ error: 'Gagal generate token', details: data })
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error: ' + error.message })
  }
}
