# Mutasi App

Aplikasi Android baca-saja untuk melihat mutasi bank/e-wallet lewat Mutasiku.

- `backend/` Express + mutasiku-sdk. API key Mutasiku hanya ada di sini (file .env).
- `app/` Expo React Native. Hanya tahu alamat server + kata sandi.

## Jalankan backend
    cd backend && cp .env.example .env   # isi MUTASIKU_API_KEY & APP_PASSWORD
    npm install && npm start
Deploy ke VPS/Railway/Render dan WAJIB pakai HTTPS.

## Build APK (GitHub)
1. Push repo (private) ke GitHub.
2. Tab Actions -> "Build APK" -> Run workflow.
3. Unduh `mutasi-apk` dari Artifacts. APK memakai debug key (cukup untuk HP pribadi).

## Pakai
Buka app, isi alamat server (https://...) dan kata sandi (= APP_PASSWORD).
Akun e-wallet dihubungkan lewat dashboard Mutasiku (alur OTP belum ada di app ini).
