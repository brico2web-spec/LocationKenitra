(function () {
  const siteKey = "kraylia-site";
  const bookingsKey = "kraylia-bookings";

  const defaultCars = [
    { id: "dacia-sandero", name: "Dacia Sandero", category: "اقتصادية", city: "الدار البيضاء", price: 250, rating: "4.9", fuel: "بنزين", transmission: "يدوية", seats: 5, badge: "الأكثر طلباً", image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80", alt: "سيارة Dacia اقتصادية" },
    { id: "renault-clio", name: "Renault Clio", category: "اقتصادية", city: "الرباط", price: 290, rating: "4.8", fuel: "ديزل", transmission: "يدوية", seats: 5, badge: "ثمن مناسب", image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80", alt: "سيارة Renault عصرية" },
    { id: "dacia-duster", name: "Dacia Duster", category: "SUV", city: "مراكش", price: 420, rating: "4.9", fuel: "ديزل", transmission: "يدوية", seats: 5, badge: "مناسبة للمغامرات", image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80", alt: "سيارة دفع رباعي" },
    { id: "hyundai-tucson", name: "Hyundai Tucson", category: "SUV", city: "طنجة", price: 580, rating: "5.0", fuel: "ديزل", transmission: "أوتوماتيك", seats: 5, badge: "اختيار ممتاز", image: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80", alt: "سيارة SUV مريحة" },
    { id: "peugeot-3008", name: "Peugeot 3008", category: "عائلية", city: "الدار البيضاء", price: 650, rating: "4.9", fuel: "ديزل", transmission: "أوتوماتيك", seats: 5, badge: "راحة أكثر", image: "https://images.unsplash.com/photo-1606611013016-969c19ba27bb?auto=format&fit=crop&w=900&q=80", alt: "سيارة عائلية مريحة" },
    { id: "mercedes-c", name: "Mercedes Classe C", category: "فاخرة", city: "مراكش", price: 1100, rating: "5.0", fuel: "بنزين", transmission: "أوتوماتيك", seats: 5, badge: "تجربة فاخرة", image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=900&q=80", alt: "سيارة Mercedes فاخرة" }
  ];

  const defaultConfig = {
    brand: { name: "كراي ليا", logo: "", contactEmail: "hello@kraylia.ma" },
    theme: { green: "#164b36", lime: "#c9ef74", paper: "#f8f8f5" },
    seo: { title: "كراي ليا — طريقك كيبدا من هنا", description: "كراء سيارات سهل وآمن في المغرب. اختار سيارتك، حدد الموعد، وأكد الحجز في دقائق." },
    nav: { cars: "السيارات", benefits: "علاش حنا", how: "كيفاش خدام", favorites: "المفضلة", book: "بدا الحجز", admin: "لوحة التحكم" },
    hero: {
      eyebrow: "كراء سيارات بلا تعقيدات",
      titleTop: "طريقك كيبدا",
      titleBottom: "من هنا.",
      description: "سيارتك الجاية واجدة. اختار، حجز، وانطلق — بثمن واضح وخدمة كتعتمد عليها.",
      points: ["حجز ساهل", "أثمنة واضحة", "اختيارات متنوعة"],
      image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1800&q=85"
    },
    pickupCities: ["الدار البيضاء", "الرباط", "مراكش", "طنجة"],
    search: { cityLabel: "فين غادي تاخدها؟", allCities: "جميع المدن", startLabel: "نهار الاستلام", endLabel: "نهار الإرجاع", button: "قلب على سيارة" },
    fleet: { title: "سيارات على قياسك", intro: "اختار من بين سيارات مختارة بعناية، وبثمن واضح.", showAll: "شوف جميع السيارات", allCategories: "الكل", empty: "ما لقيناش سيارات بهاد الاختيارات.", emptyFavorites: "مازال ما زدتي حتى سيارة للمفضلة." },
    benefits: {
      title: "راحة البال داخلة فالثمن",
      intro: "كلشي واضح من أول كليكة حتى ترجع المفتاح.",
      items: [
        { title: "ثمن بلا مفاجآت", description: "الثمن اللي كتشوف هو الثمن اللي كتخلص. ما كايناش مصاريف مخبية." },
        { title: "حجز فدقايق", description: "اختار السيارة والتواريخ ديالك وكمل طلب الحجز بسهولة." },
        { title: "توصيل حتى لعندك", description: "اختار المدينة ونقطة الاستلام اللي كتناسبك." },
        { title: "معلومات واضحة", description: "شوف مواصفات السيارة والثمن قبل ما تبدا طلب الحجز ديالك." }
      ]
    },
    how: {
      title: "من الاختيار للطريق، بسهولة",
      intro: "ثلاث خطوات وتكون واجد تمشي.",
      steps: [
        { label: "اختار", title: "لقا اللي كيناسبك", description: "قلب حسب المدينة ونوع السيارة، وقارن المواصفات والثمن." },
        { label: "أكد", title: "دخل معلوماتك", description: "عمر بيانات التواصل والتواريخ باش نسجلو طلب الحجز ديالك." },
        { label: "انطلق", title: "كمل التأكيد", description: "من بعد إرسال الطلب، خاص تأكيد التوفر والتفاصيل مع الجهة المكلفة بالكراء." }
      ]
    },
    booking: {
      title: "طلب حجز السيارة", intro: "دخل معلوماتك باش نكملو الطلب ديالك.",
      name: "الاسم الكامل", phone: "رقم الهاتف", city: "مدينة الاستلام", chooseCity: "اختار المدينة",
      start: "نهار الاستلام", end: "نهار الإرجاع", payment: "طريقة الأداء المفضلة",
      cash: "الأداء عند الاستلام", card: "بطاقة بنكية عند الاستلام", total: "المجموع التقديري",
      submit: "أكد طلب الحجز", done: "واخا، شكراً"
    },
    cta: { title: "الرحلة الجاية؟ خليه علينا.", description: "قلب على السيارة المناسبة وانطلق مرتاح.", button: "اختار سيارتك" },
    footer: { copyright: "جميع الحقوق محفوظة.", cars: "السيارات", benefits: "علاش حنا", how: "كيفاش خدام", contact: "تواصل معنا" },
    cars: defaultCars
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readSite() {
    try {
      const saved = localStorage.getItem(siteKey);
      if (!saved) return clone(defaultConfig);
      const value = JSON.parse(saved);
      if (!value || typeof value !== "object") return clone(defaultConfig);
      return {
        ...clone(defaultConfig),
        ...value,
        brand: { ...defaultConfig.brand, ...value.brand },
        theme: { ...defaultConfig.theme, ...value.theme },
        seo: { ...defaultConfig.seo, ...value.seo },
        nav: { ...defaultConfig.nav, ...value.nav },
        hero: { ...defaultConfig.hero, ...value.hero },
        pickupCities: Array.isArray(value.pickupCities)
          ? [...new Set(value.pickupCities.filter(city => typeof city === "string" && city.trim()).map(city => city.trim()))]
          : clone(defaultConfig.pickupCities),
        search: { ...defaultConfig.search, ...value.search },
        fleet: { ...defaultConfig.fleet, ...value.fleet },
        benefits: {
          ...defaultConfig.benefits, ...value.benefits,
          items: Array.isArray(value.benefits?.items)
            ? defaultConfig.benefits.items.map((item, index) => ({ ...item, ...value.benefits.items[index] }))
            : clone(defaultConfig.benefits.items)
        },
        how: {
          ...defaultConfig.how, ...value.how,
          steps: Array.isArray(value.how?.steps)
            ? defaultConfig.how.steps.map((step, index) => ({ ...step, ...value.how.steps[index] }))
            : clone(defaultConfig.how.steps)
        },
        booking: { ...defaultConfig.booking, ...value.booking },
        cta: { ...defaultConfig.cta, ...value.cta },
        footer: { ...defaultConfig.footer, ...value.footer },
        cars: Array.isArray(value.cars) ? value.cars : clone(defaultCars)
      };
    } catch (error) {
      console.error("Unable to read the saved website settings.", error);
      return clone(defaultConfig);
    }
  }

  function saveSite(value) {
    try {
      localStorage.setItem(siteKey, JSON.stringify(value));
    } catch (error) {
      console.error("Unable to save the website settings.", error);
      throw new Error("تعذر حفظ الإعدادات. ممكن يكون تخزين المتصفح عامر.");
    }
  }

  function readBookings() {
    try {
      const saved = JSON.parse(localStorage.getItem(bookingsKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.error("Unable to read saved booking requests.", error);
      return [];
    }
  }

  function saveBookings(bookings) {
    try {
      localStorage.setItem(bookingsKey, JSON.stringify(bookings));
    } catch (error) {
      console.error("Unable to save booking requests.", error);
      throw new Error("تعذر حفظ الطلبات فهاد المتصفح.");
    }
  }

  window.KrayliaStore = {
    siteKey,
    bookingsKey,
    defaultCars,
    defaultConfig,
    clone,
    readSite,
    saveSite,
    readBookings,
    saveBookings
  };
})();
