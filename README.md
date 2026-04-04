# 🌳 شجرة العائلة — Familienstammbaum

> تطبيق ويب تفاعلي لعرض وإدارة شجرة العائلة، مبني بـ Node.js و D3.js

---

## ✨ المميزات

- 🌐 عرض شجرة العائلة بشكل تفاعلي وبصري
- ➕ إضافة عدة أبناء لنفس الأب دفعة واحدة
- ✏️ تغيير الأسماء، نقل الأشخاص، حذفهم
- 💻 تمييز مؤسس الصفحة بإطار خاص
- 🔐 لوحة إدارة محمية بكلمة مرور
- 💾 حفظ البيانات تلقائياً في GitHub
- 📱 يعمل على الهاتف والحاسوب

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---|---|
| Node.js + Express | الخادم |
| D3.js v7 | رسم الشجرة |
| GitHub API | تخزين البيانات |
| Railway | الاستضافة |
| Vanilla JS (ES Modules) | الواجهة الأمامية |

---

## 🚀 تشغيل المشروع محلياً

```bash
git clone https://github.com/ah-alkhalaf/familienbaum.git
cd familienbaum
npm install
```

أنشئ ملف `.env`:

```
ADMIN_USER=admin
ADMIN_PASS=your_password
SESSION_SECRET=your_secret
GITHUB_TOKEN=your_github_token
GITHUB_REPO=ah-alkhalaf/familienbaum
GITHUB_FILE=family.json
```

```bash
npm start
```

ثم افتح المتصفح على `http://localhost:3000`

---

## 🔐 الوصول للوحة الإدارة

- اضغط `Alt + A` أو أضف `?admin=1` في الرابط
- سجّل الدخول بالبيانات المحددة في `.env`

---

## 📁 هيكل المشروع

```
familienbaum/
├── server.js           # الخادم الرئيسي
├── family.json         # بيانات الشجرة
├── package.json
├── public/
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   └── modules/
│       ├── api.js
│       ├── auth.js
│       ├── tree.js
│       └── ui.js
└── backups/            # نسخ احتياطية محلية
```

---

## 📄 الترخيص

© 2025 **ah-alkhalaf** — جميع الحقوق محفوظة.  
انظر ملف [LICENSE](./LICENSE) للتفاصيل.
