import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        register: resolve(__dirname, 'register.html'),
        fieldDetail: resolve(__dirname, 'field-detail.html'),
        myBookings: resolve(__dirname, 'my-bookings.html'),
        bookingDetail: resolve(__dirname, 'booking-detail.html'),
        adminDashboard: resolve(__dirname, 'admin/dashboard.html'),
        adminFields: resolve(__dirname, 'admin/fields.html'),
        adminBookings: resolve(__dirname, 'admin/bookings.html'),
        adminPayments: resolve(__dirname, 'admin/payments.html'),
      }
    }
  }
})
