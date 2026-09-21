/* ============ open-sites.io — мультиязычность (RU / EN / KA) ============
   Тексты хранятся здесь. Чтобы поправить формулировку — правим значение по ключу.
   Цены подставляются через плейсхолдеры {P_...} — чтобы курс правился в одном месте. */

/* Курс на 2026-07-21: 1 $ ≈ 78,5 ₽ · 1 ₾ ≈ 30 ₽ */
const PRICES = {
  ru: { P_LANDING: "30 000 ₽", P_BIZ: "70 000 ₽", P_TMA: "80 000 ₽", P_SUPPORT: "3 000 ₽/мес", P_DOMAIN: "300 ₽/год" },
  en: { P_LANDING: "$390", P_BIZ: "$900", P_TMA: "$1,020", P_SUPPORT: "$40/mo", P_DOMAIN: "$4/year" },
  ka: { P_LANDING: "1 000 ₾", P_BIZ: "2 350 ₾", P_TMA: "2 700 ₾", P_SUPPORT: "100 ₾/თვე", P_DOMAIN: "10 ₾/წელი" },
};

const I18N = {
  ru: {
    "meta.title": "open-sites.io — сайты, которые продают. Лендинг за 3–5 дней",
    "meta.desc": "Создаём продающие сайты и Telegram Mini Apps за дни, а не месяцы. Фиксированная цена, безлимитные правки до сдачи, заявки прямо в ваш Telegram.",
    "nav.services": "Услуги",
    "nav.cases": "Кейсы",
    "nav.process": "Процесс",
    "nav.faq": "FAQ",
    "nav.cta": "Оставить заявку",
    "hero.badge": "Берём проекты на июнь — осталось 3 места",
    "hero.h1a": "Сайты, которые",
    "hero.h1b": "продают",
    "hero.h1c": "Запуск за 3–5 дней.",
    "hero.lead": "Лендинги, сайты для бизнеса и Telegram Mini Apps. Фиксированная цена, безлимитные правки до сдачи, заявки клиентов — сразу в ваш Telegram.",
    "hero.cta1": "Получить скидку −20%",
    "hero.cta2": "Смотреть кейсы",
    "hero.note": "Скидка фиксируется на бесплатной консультации — это просто разговор, ни к чему не обязывает.",
    "stats.days": "дней",
    "stats.l1": "средний срок запуска",
    "stats.l2": "быстрее классических студий",
    "stats.l3": "правок до сдачи бесплатно",
    "stats.l4": "заявки падают в ваш Telegram",
    "svc.tag": "Услуги",
    "svc.h2": "Что мы делаем",
    "svc.sub": "Цена фиксируется до старта и не меняется. В каждый проект входят адаптив под телефоны, форма заявки и базовое SEO.",
    "svc.1.t": "Лендинг",
    "svc.1.d": "Продающая страница под одну услугу или товар",
    "svc.2.t": "Сайт для бизнеса",
    "svc.2.d": "Многостраничный сайт компании под ключ",
    "svc.3.t": "Telegram Mini App",
    "svc.3.d": "Приложение прямо внутри Telegram",
    "svc.4.t": "Помощь с доменом",
    "svc.4.d": "Домен, почта и SSL — техчасть на нас",
    "svc.5.t": "Сопровождение",
    "svc.5.d": "Поддержка и развитие после запуска",
    "tbl.h1": "Услуга",
    "tbl.h2": "Описание",
    "tbl.h3": "Сроки",
    "tbl.h4": "Стоимость",
    "tbl.1.d": "Продающая страница: оффер, выгоды, кейсы, отзывы, FAQ и форма заявки. Для рекламы и быстрого старта продаж.",
    "tbl.1.term": "3–5 дней",
    "tbl.2.d": "Услуги, прайс, портфолио, команда и контакты. Онлайн-запись, интеграция с CRM и базовое SEO.",
    "tbl.2.term": "1–2 недели",
    "tbl.3.d": "Каталог, запись, оплата и личный кабинет прямо в Telegram. Клиенты пользуются без скачивания приложений.",
    "tbl.3.term": "от 1 недели",
    "tbl.4.d": "Подбор и регистрация домена, почта на вашем адресе, SSL и подключение к сайту. Всю техчасть берём на себя.",
    "tbl.4.term": "под ключ",
    "tbl.5.d": "Обновления, правки контента, бэкапы, мониторинг доступности и скорости. Сайт всегда онлайн и актуален.",
    "tbl.5.term": "ежемесячно",
    "cases.tag": "Кейсы",
    "cases.h2": "Цифры вместо обещаний",
    "cases.badge": "концепт",
    "cases.1.n": "Ремонт и отделка",
    "cases.1.t": "Лендинг для студии ремонта",
    "cases.1.d": "Заменили устаревший сайт-визитку на лендинг с калькулятором сметы и квиз-формой. Запуск за 4 дня.",
    "cases.1.m": "заявок в первый месяц",
    "cases.2.n": "Салон красоты",
    "cases.2.t": "Сайт с онлайн-записью",
    "cases.2.d": "Сайт с записью без звонков и напоминаниями в Telegram. Администратор разгружен, окна в расписании заполнены.",
    "cases.2.m": "выручки за два месяца",
    "cases.3.n": "Отопительное оборудование",
    "cases.3.t": "Витрина с подбором по параметрам",
    "cases.3.d": "Каталог котлов с фильтром-подборщиком: клиент сам собирает комплект, менеджер получает готовую заявку.",
    "cases.3.m": "к среднему чеку",
    "cases.4.n": "Фитнес-студия",
    "cases.4.t": "Telegram Mini App для записи",
    "cases.4.d": "Запись на тренировки прямо в Telegram: расписание, абонементы, оплата. Без скачивания приложений.",
    "cases.4.m": "записей через мини-апп за квартал",
    "cases.note": "Кейсы с пометкой «концепт» — демонстрационные работы студии. Раздел обновляется по мере выхода клиентских проектов.",
    "proc.tag": "Процесс",
    "proc.h2a": "От заявки до запуска —",
    "proc.h2b": "4 шага",
    "proc.1.t": "Бриф",
    "proc.1.d": "Заполняете короткую анкету: галочки и выпадающие списки, никаких сочинений. Прикладываете референсы — сайты, которые нравятся.",
    "proc.1.time": "≈ 7 минут",
    "proc.2.t": "Концепт",
    "proc.2.d": "Показываем дизайн главного экрана. Не понравится — переделаем или вернём предоплату.",
    "proc.2.time": "24–48 часов",
    "proc.3.t": "Сборка",
    "proc.3.d": "Собираем сайт целиком. Правки на этом этапе — без ограничений и доплат.",
    "proc.3.time": "2–7 дней",
    "proc.4.t": "Запуск",
    "proc.4.d": "Публикуем на вашем домене, настраиваем заявки в ваш Telegram, передаём все доступы.",
    "proc.4.time": "1 день",
    "offer.h2": "−20% на первый проект",
    "offer.calm": "Оставьте заявку, пока действует предложение, — скидка закрепится за вами на <b>бесплатной консультации</b>. Это просто разговор о вашей задаче: без оплаты, без обязательств, бриф можно заполнить за 7 минут.",
    "offer.h": "часов",
    "offer.m": "минут",
    "offer.s": "секунд",
    "offer.cta": "Забронировать скидку",
    "faq.tag": "FAQ",
    "faq.h2": "Частые вопросы",
    "faq.q1": "Почему так быстро? В студиях это занимает месяцы.",
    "faq.a1": "Мы используем собственную систему шаблонов и ИИ-инструменты разработки: типовые блоки уже отлажены, поэтому время уходит на ваш дизайн и тексты, а не на рутину. Скорость не означает шаблонность — внешний вид собирается под ваш референс.",
    "faq.q2": "Что если мне не понравится результат?",
    "faq.a2": "Сначала вы видите концепт главного экрана. Не нравится — переделываем или возвращаем предоплату. На этапе сборки правки безлимитные и бесплатные до сдачи проекта.",
    "faq.q3": "Сколько это стоит и от чего зависит цена?",
    "faq.a3": "Лендинг — от {P_LANDING}, сайт для бизнеса — от {P_BIZ}, Telegram Mini App — от {P_TMA}. Цена зависит от количества блоков и интеграций (CRM, оплата, онлайн-запись) и фиксируется до старта — никаких «вылезло по ходу».",
    "faq.q4": "Нужно ли мне разбираться в технике? Домен, хостинг…",
    "faq.a4": "Нет. Поможем купить домен (это 10 минут и от ~{P_DOMAIN}), хостинг для большинства проектов бесплатный. Все доступы остаются у вас — сайт принадлежит вам, а не нам.",
    "faq.q5": "Что происходит с сайтом после запуска?",
    "faq.a5": "Месяц бесплатной поддержки после сдачи. Дальше — по желанию: тариф поддержки от {P_SUPPORT} (правки, обновления, мониторинг) или сайт просто работает сам, он ваш.",
    "faq.q6": "Скидка по таймеру — это правда или маркетинг?",
    "faq.a6": "Правда: мы берём ограниченное число проектов в месяц, и скидка действует на ближайшие свободные места. Если успели оставить заявку — скидка закрепляется за вами на консультации, даже если сам проект стартует позже.",
    "footer.tagline": "Сайты, которые продают. 2026",
    "float.cta": "Заявка −20%",
    "price.note": "Цены указаны ориентировочно и пересчитаны по текущему курсу.",
    "cost.1": "от 30 000 ₽",
    "cost.2": "от 70 000 ₽",
    "cost.3": "от 80 000 ₽",
    "cost.4": "от 2 000 ₽",
    "cost.5": "от 3 000 ₽",
    "cost.permonth": "/мес",
  },

  /* EN и KA подставляются ниже (переведены и проверены отдельно) */
  en: {
    "meta.title": "open-sites.io — Websites That Sell. Landing Pages in 3–5 Days",
    "meta.desc": "High-converting websites and Telegram Mini Apps built in days, not months. Fixed price, unlimited revisions until launch, and leads delivered straight to your Telegram.",
    "nav.services": "Services",
    "nav.cases": "Work",
    "nav.process": "Process",
    "nav.faq": "FAQ",
    "nav.cta": "Get a quote",
    "hero.badge": "Booking June projects — 3 spots left",
    "hero.h1a": "Websites that",
    "hero.h1b": "sell",
    "hero.h1c": "Live in 3–5 days.",
    "hero.lead": "Landing pages, business websites and Telegram Mini Apps. Fixed price, unlimited revisions until launch, and every lead lands straight in your Telegram.",
    "hero.cta1": "Claim your 20% off",
    "hero.cta2": "See our work",
    "hero.note": "Your discount is locked in on a free consultation — just a conversation, zero commitment.",
    "stats.days": "days",
    "stats.l1": "average time to launch",
    "stats.l2": "faster than traditional agencies",
    "stats.l3": "free revisions before launch",
    "stats.l4": "leads land in your Telegram",
    "svc.tag": "Services",
    "svc.h2": "What we build",
    "svc.sub": "The price is locked in before we start and never changes. Every project includes mobile-ready design, a lead form and SEO essentials.",
    "svc.1.t": "Landing page",
    "svc.1.d": "A conversion page for one service or product",
    "svc.2.t": "Business website",
    "svc.2.d": "A complete multi-page company site, built end to end",
    "svc.3.t": "Telegram Mini App",
    "svc.3.d": "An app that lives right inside Telegram",
    "svc.4.t": "Domain setup",
    "svc.4.d": "Domain, email and SSL — we handle the tech",
    "svc.5.t": "Ongoing support",
    "svc.5.d": "Maintenance and growth after launch",
    "tbl.h1": "Service",
    "tbl.h2": "What you get",
    "tbl.h3": "Timeline",
    "tbl.h4": "Price",
    "tbl.1.d": "A conversion page: offer, benefits, case studies, reviews, FAQ and a lead form. Built for ad traffic and fast sales.",
    "tbl.1.term": "3–5 days",
    "tbl.2.d": "Services, pricing, portfolio, team and contacts. Online booking, CRM integration and SEO essentials.",
    "tbl.2.term": "1–2 weeks",
    "tbl.3.d": "Catalog, booking, payments and user accounts right inside Telegram. No app downloads for your customers.",
    "tbl.3.term": "from 1 week",
    "tbl.4.d": "Domain selection and registration, email at your own domain, SSL and connection to your site. We handle all the technical work.",
    "tbl.4.term": "turnkey",
    "tbl.5.d": "Updates, content edits, backups, uptime and speed monitoring. Your site stays online and current.",
    "tbl.5.term": "monthly",
    "cases.tag": "Work",
    "cases.h2": "Numbers, not promises",
    "cases.badge": "concept",
    "cases.1.n": "Renovation & interiors",
    "cases.1.t": "Landing page for a renovation studio",
    "cases.1.d": "Replaced a dated brochure site with a landing page featuring a cost calculator and a quiz form. Launched in 4 days.",
    "cases.1.m": "leads in the first month",
    "cases.2.n": "Beauty salon",
    "cases.2.t": "Website with online booking",
    "cases.2.d": "Booking without phone calls, plus reminders in Telegram. Less work for the front desk, and the gaps in the schedule get filled.",
    "cases.2.m": "revenue growth in two months",
    "cases.3.n": "Heating equipment",
    "cases.3.t": "Catalog with a product finder",
    "cases.3.d": "A boiler catalog with a spec-based product finder: customers build their own package and the sales rep gets a complete request.",
    "cases.3.m": "higher average order value",
    "cases.4.n": "Fitness studio",
    "cases.4.t": "Telegram Mini App for bookings",
    "cases.4.d": "Class booking right inside Telegram: schedule, memberships, payments. No app downloads required.",
    "cases.4.m": "mini-app bookings in one quarter",
    "cases.note": "Projects marked \"concept\" are in-house demo builds. This section is updated as client projects go live.",
    "proc.tag": "Process",
    "proc.h2a": "From inquiry to launch —",
    "proc.h2b": "4 steps",
    "proc.1.t": "Brief",
    "proc.1.d": "You fill out a short form — checkboxes and dropdowns, no essays. Add references: sites you like.",
    "proc.1.time": "≈ 7 minutes",
    "proc.2.t": "Concept",
    "proc.2.d": "We show you a design concept for your hero section. Don't like it? We redo it or refund your deposit.",
    "proc.2.time": "24–48 hours",
    "proc.3.t": "Build",
    "proc.3.d": "We build the full site. Revisions at this stage are unlimited and cost nothing extra.",
    "proc.3.time": "2–7 days",
    "proc.4.t": "Launch",
    "proc.4.d": "We publish on your domain, route leads into your Telegram and hand over all the logins.",
    "proc.4.time": "1 day",
    "offer.h2": "20% off your first project",
    "offer.calm": "Get in touch while the offer is live — your discount is locked in during a <b>free consultation</b>. It's just a conversation about your project: no payment, no obligation, and the brief takes 7 minutes.",
    "offer.h": "hours",
    "offer.m": "minutes",
    "offer.s": "seconds",
    "offer.cta": "Lock in my discount",
    "faq.tag": "FAQ",
    "faq.h2": "Frequently asked questions",
    "faq.q1": "Why so fast? Agencies take months.",
    "faq.a1": "We use our own template system and AI development tools: the standard building blocks are already battle-tested, so our time goes into your design and copy instead of busywork. Fast doesn't mean cookie-cutter — the look is built around your references.",
    "faq.q2": "What if I don't like the result?",
    "faq.a2": "You see the hero section concept first. If it's not right, we redo it or refund your deposit. During the build, revisions are unlimited and free until the project ships.",
    "faq.q3": "How much does it cost, and what drives the price?",
    "faq.a3": "Landing page from {P_LANDING}, business website from {P_BIZ}, Telegram Mini App from {P_TMA}. The price depends on the number of sections and integrations (CRM, payments, online booking) and is locked in before we start — no surprise add-ons halfway through.",
    "faq.q4": "Do I need to be technical? Domains, hosting…",
    "faq.a4": "No. We'll help you buy a domain (10 minutes, from about {P_DOMAIN}), and hosting is free for most projects. All the logins stay with you — the site is yours, not ours.",
    "faq.q5": "What happens after launch?",
    "faq.a5": "A free month of support after handover. After that it's your call: a support plan from {P_SUPPORT} (edits, updates, monitoring), or the site simply keeps running on its own — it's yours.",
    "faq.q6": "Is the countdown discount real, or just marketing?",
    "faq.a6": "Real: we take on a limited number of projects each month, and the discount applies to the next open spots. Get in touch in time and it's locked in at your consultation, even if the project itself starts later.",
    "footer.tagline": "Websites that sell. 2026",
    "float.cta": "Get 20% off",
    "price.note": "Prices are indicative and converted at the current exchange rate.",
    "cost.1": "from $390",
    "cost.2": "from $900",
    "cost.3": "from $1,020",
    "cost.4": "from $25",
    "cost.5": "from $40",
    "cost.permonth": "/mo",
  },
  ka: {
    "meta.title": "open-sites.io — საიტები, რომლებიც ყიდიან. ლენდინგი 3–5 დღეში",
    "meta.desc": "ვქმნით გამყიდველ საიტებსა და Telegram Mini App-ებს დღეებში და არა თვეებში. ფიქსირებული ფასი, შეუზღუდავი შესწორებები ჩაბარებამდე, განაცხადები პირდაპირ თქვენს Telegram-ში.",
    "nav.services": "სერვისები",
    "nav.cases": "ქეისები",
    "nav.process": "პროცესი",
    "nav.faq": "FAQ",
    "nav.cta": "განაცხადის გაგზავნა",
    "hero.badge": "ვიღებთ პროექტებს ივნისისთვის — დარჩა 3 ადგილი",
    "hero.h1a": "საიტები, რომლებიც",
    "hero.h1b": "ყიდიან",
    "hero.h1c": "გაშვება 3–5 დღეში.",
    "hero.lead": "ლენდინგები, ბიზნესსაიტები და Telegram Mini App-ები. ფიქსირებული ფასი, შეუზღუდავი შესწორებები ჩაბარებამდე, კლიენტების განაცხადები — პირდაპირ თქვენს Telegram-ში.",
    "hero.cta1": "მიიღეთ −20% ფასდაკლება",
    "hero.cta2": "ქეისების ნახვა",
    "hero.note": "ფასდაკლება ფიქსირდება უფასო კონსულტაციაზე — ეს უბრალოდ საუბარია და არანაირ ვალდებულებას არ გულისხმობს.",
    "stats.days": "დღე",
    "stats.l1": "გაშვების საშუალო ვადა",
    "stats.l2": "უფრო სწრაფად, ვიდრე კლასიკური სტუდიები",
    "stats.l3": "შესწორება ჩაბარებამდე უფასოდ",
    "stats.l4": "განაცხადები პირდაპირ თქვენს Telegram-ში მოდის",
    "svc.tag": "სერვისები",
    "svc.h2": "რას ვაკეთებთ",
    "svc.sub": "ფასი ფიქსირდება სტარტამდე და აღარ იცვლება. ყველა პროექტში შედის მობილურზე ადაპტირებული დიზაინი, განაცხადის ფორმა და საბაზისო SEO.",
    "svc.1.t": "ლენდინგი",
    "svc.1.d": "გამყიდველი გვერდი ერთი სერვისის ან პროდუქტისთვის",
    "svc.2.t": "ბიზნესსაიტი",
    "svc.2.d": "მრავალგვერდიანი კორპორატიული საიტი სრული მომსახურებით",
    "svc.3.t": "Telegram Mini App",
    "svc.3.d": "აპლიკაცია პირდაპირ Telegram-ის შიგნით",
    "svc.4.t": "დომენში დახმარება",
    "svc.4.d": "დომენი, ელფოსტა და SSL — ტექნიკური ნაწილი ჩვენზეა",
    "svc.5.t": "ტექნიკური მხარდაჭერა",
    "svc.5.d": "მხარდაჭერა და განვითარება გაშვების შემდეგ",
    "tbl.h1": "სერვისი",
    "tbl.h2": "აღწერა",
    "tbl.h3": "ვადები",
    "tbl.h4": "ღირებულება",
    "tbl.1.d": "გამყიდველი გვერდი: შეთავაზება, სარგებელი, ქეისები, გამოხმაურებები, FAQ და განაცხადის ფორმა. რეკლამისა და გაყიდვების სწრაფი სტარტისთვის.",
    "tbl.1.term": "3–5 დღე",
    "tbl.2.d": "სერვისები, ფასები, პორტფოლიო, გუნდი და კონტაქტები. ონლაინ ჩაწერა, CRM-თან ინტეგრაცია და საბაზისო SEO.",
    "tbl.2.term": "1–2 კვირა",
    "tbl.3.d": "კატალოგი, ჩაწერა, გადახდა და პირადი კაბინეტი პირდაპირ Telegram-ში. კლიენტები სარგებლობენ აპლიკაციის ჩამოტვირთვის გარეშე.",
    "tbl.3.term": "1 კვირიდან",
    "tbl.4.d": "დომენის შერჩევა და რეგისტრაცია, ელფოსტა თქვენს დომენზე, SSL და საიტთან მიერთება. მთელ ტექნიკურ ნაწილს ჩვენ ვიღებთ თავზე.",
    "tbl.4.term": "სრული მომსახურება",
    "tbl.5.d": "განახლებები, კონტენტის შესწორება, სარეზერვო ასლები, ხელმისაწვდომობისა და სიჩქარის მონიტორინგი. საიტი ყოველთვის ონლაინ და აქტუალურია.",
    "tbl.5.term": "ყოველთვიურად",
    "cases.tag": "ქეისები",
    "cases.h2": "ციფრები დაპირებების ნაცვლად",
    "cases.badge": "კონცეპტი",
    "cases.1.n": "რემონტი და მოპირკეთება",
    "cases.1.t": "ლენდინგი სარემონტო სტუდიისთვის",
    "cases.1.d": "მოძველებული სავიზიტო საიტი ჩავანაცვლეთ ლენდინგით, სადაც არის ხარჯთაღრიცხვის კალკულატორი და ქვიზ-ფორმა. გაშვება 4 დღეში.",
    "cases.1.m": "განაცხადი პირველ თვეში",
    "cases.2.n": "სილამაზის სალონი",
    "cases.2.t": "საიტი ონლაინ ჩაწერით",
    "cases.2.d": "საიტი, სადაც ჩაწერა ზარის გარეშე ხდება, შეხსენებები კი Telegram-ში მოდის. ადმინისტრატორი განიტვირთა, განრიგში თავისუფალი ფანჯრები შეივსო.",
    "cases.2.m": "შემოსავლის ზრდა ორ თვეში",
    "cases.3.n": "გამათბობელი აღჭურვილობა",
    "cases.3.t": "ვიტრინა პარამეტრებით შერჩევის შესაძლებლობით",
    "cases.3.d": "გამათბობელი ქვაბების კატალოგი შერჩევის ფილტრით: კლიენტი თავად აწყობს კომპლექტს, მენეჯერი კი მზა განაცხადს იღებს.",
    "cases.3.m": "საშუალო ჩეკის ზრდა",
    "cases.4.n": "ფიტნეს-სტუდია",
    "cases.4.t": "Telegram Mini App ჩასაწერად",
    "cases.4.d": "ვარჯიშებზე ჩაწერა პირდაპირ Telegram-ში: განრიგი, აბონემენტები, გადახდა. აპლიკაციის ჩამოტვირთვის გარეშე.",
    "cases.4.m": "ჩაწერა Mini App-ით კვარტალში",
    "cases.note": "„კონცეპტის“ ნიშნის მქონე ქეისები სტუდიის სადემონსტრაციო სამუშაოებია. სექცია განახლდება კლიენტების პროექტების გამოქვეყნებისთანავე.",
    "proc.tag": "პროცესი",
    "proc.h2a": "განაცხადიდან გაშვებამდე —",
    "proc.h2b": "4 ნაბიჯი",
    "proc.1.t": "ბრიფი",
    "proc.1.d": "ავსებთ მოკლე კითხვარს: მონიშვნები და ჩამოსაშლელი სიები, არანაირი თხზულება. ურთავთ რეფერენსებს — საიტებს, რომლებიც მოგწონთ.",
    "proc.1.time": "≈ 7 წუთი",
    "proc.2.t": "კონცეპტი",
    "proc.2.d": "გაჩვენებთ მთავარი ეკრანის დიზაინს. თუ არ მოგეწონებათ — გადავაკეთებთ ან ავანსს დაგიბრუნებთ.",
    "proc.2.time": "24–48 საათი",
    "proc.3.t": "დამზადება",
    "proc.3.d": "ვქმნით საიტს სრულად. ამ ეტაპზე შესწორებები — შეუზღუდავი და დამატებითი გადახდის გარეშე.",
    "proc.3.time": "2–7 დღე",
    "proc.4.t": "გაშვება",
    "proc.4.d": "ვაქვეყნებთ თქვენს დომენზე, ვაწყობთ განაცხადების მიღებას თქვენს Telegram-ში, გადმოგცემთ ყველა წვდომას.",
    "proc.4.time": "1 დღე",
    "offer.h2": "−20% პირველ პროექტზე",
    "offer.calm": "დატოვეთ განაცხადი, სანამ შეთავაზება მოქმედებს — ფასდაკლება თქვენზე დაფიქსირდება <b>უფასო კონსულტაციაზე</b>. ეს უბრალოდ საუბარია თქვენს პროექტზე: გადახდის გარეშე, ვალდებულებების გარეშე, ბრიფის შევსებას კი სულ 7 წუთი სჭირდება.",
    "offer.h": "საათი",
    "offer.m": "წუთი",
    "offer.s": "წამი",
    "offer.cta": "ფასდაკლების დაჯავშნა",
    "faq.tag": "FAQ",
    "faq.h2": "ხშირად დასმული კითხვები",
    "faq.q1": "რატომ ასე სწრაფად? სტუდიებში ამას თვეები სჭირდება.",
    "faq.a1": "ვიყენებთ შაბლონების საკუთარ სისტემას და ხელოვნური ინტელექტის სადეველოპერო ინსტრუმენტებს: ტიპური ბლოკები უკვე გამართულია, ამიტომ დრო თქვენს დიზაინსა და ტექსტებზე იხარჯება და არა რუტინაზე. სისწრაფე შაბლონურობას არ ნიშნავს — ვიზუალი თქვენს რეფერენსზე იწყობა.",
    "faq.q2": "რა მოხდება, თუ შედეგი არ მომეწონება?",
    "faq.a2": "ჯერ ხედავთ მთავარი ეკრანის კონცეპტს. თუ არ მოგწონთ — გადავაკეთებთ ან ავანსს დაგიბრუნებთ. დამზადების ეტაპზე შესწორებები შეუზღუდავი და უფასოა პროექტის ჩაბარებამდე.",
    "faq.q3": "რა ღირს და რაზეა დამოკიდებული ფასი?",
    "faq.a3": "ლენდინგი — {P_LANDING}-დან, ბიზნესსაიტი — {P_BIZ}-დან, Telegram Mini App — {P_TMA}-დან. ფასი დამოკიდებულია ბლოკებისა და ინტეგრაციების რაოდენობაზე (CRM, გადახდა, ონლაინ ჩაწერა) და ფიქსირდება სტარტამდე — არანაირი „გზადაგზა ამოტივტივებული“ დანამატი.",
    "faq.q4": "საჭიროა თუ არა ტექნიკურ საკითხებში გარკვევა? დომენი, ჰოსტინგი…",
    "faq.a4": "არა. დაგეხმარებით დომენის შეძენაში (ეს 10 წუთია და ~{P_DOMAIN}-დან), ჰოსტინგი კი პროექტების უმეტესობისთვის უფასოა. ყველა წვდომა თქვენთან რჩება — საიტი თქვენია და არა ჩვენი.",
    "faq.q5": "რა ხდება საიტთან გაშვების შემდეგ?",
    "faq.a5": "ჩაბარების შემდეგ ერთი თვე უფასო მხარდაჭერაა. შემდეგ — სურვილისამებრ: მხარდაჭერის ტარიფი {P_SUPPORT}-დან (შესწორებები, განახლებები, მონიტორინგი) ან საიტი უბრალოდ თავად მუშაობს — ის თქვენია.",
    "faq.q6": "ტაიმერიანი ფასდაკლება — ეს სიმართლეა თუ მარკეტინგი?",
    "faq.a6": "სიმართლეა: თვეში პროექტების შეზღუდულ რაოდენობას ვიღებთ და ფასდაკლება უახლოეს თავისუფალ ადგილებზე მოქმედებს. თუ განაცხადის გაგზავნა მოასწარით — ფასდაკლება თქვენზე ფიქსირდება კონსულტაციაზე, თუნდაც პროექტი მოგვიანებით დაიწყოს.",
    "footer.tagline": "საიტები, რომლებიც ყიდიან. 2026",
    "float.cta": "განაცხადი −20%",
    "price.note": "ფასები მითითებულია სავარაუდოდ და გადაანგარიშებულია მიმდინარე კურსით.",
    "cost.1": "1 000 ₾-დან",
    "cost.2": "2 350 ₾-დან",
    "cost.3": "2 700 ₾-დან",
    "cost.4": "70 ₾-დან",
    "cost.5": "100 ₾-დან",
    "cost.permonth": "/თვე",
  },
};

/* ---------- движок ---------- */
const LANG_LABELS = { ru: "RU", en: "EN", ka: "ქა" };

function osSubstPrices(text, lang) {
  const p = PRICES[lang] || PRICES.ru;
  return text.replace(/\{(P_[A-Z_]+)\}/g, (m, k) => (k in p ? p[k] : m));
}

function osApplyLang(lang) {
  if (!I18N[lang] || !Object.keys(I18N[lang]).length) lang = "ru";
  const dict = I18N[lang];

  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const val = dict[el.getAttribute("data-i18n")];
    if (val == null) return;
    const text = osSubstPrices(val, lang);
    if (/<[a-z][\s\S]*>/i.test(text)) el.innerHTML = text;
    else el.textContent = text;
  });

  /* подписи для мобильной таблицы (псевдоэлементы читают data-label) */
  document.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const val = dict[el.getAttribute("data-i18n-label")];
    if (val) el.setAttribute("data-label", val);
  });

  if (dict["meta.title"]) document.title = dict["meta.title"];
  const md = document.querySelector('meta[name="description"]');
  if (md && dict["meta.desc"]) md.setAttribute("content", dict["meta.desc"]);

  /* примечание о пересчёте цен — только для валют, отличных от рубля */
  const note = document.getElementById("priceNote");
  if (note) note.hidden = lang === "ru";

  document.querySelectorAll(".lang-opt").forEach((b) =>
    b.classList.toggle("on", b.getAttribute("data-lang") === lang)
  );
  const curLabel = document.getElementById("langCurLabel");
  if (curLabel) curLabel.textContent = LANG_LABELS[lang] || lang.toUpperCase();

  try { localStorage.setItem("os_lang", lang); } catch (_) {}
}

function osInitLang() {
  let saved = null;
  try { saved = localStorage.getItem("os_lang"); } catch (_) {}
  const nav = (navigator.language || "ru").slice(0, 2).toLowerCase();
  const guess = saved || (["ru", "en", "ka"].includes(nav) ? nav : "ru");
  osApplyLang(guess);

  const dd = document.getElementById("langDd");
  const trigger = document.getElementById("langCurrent");

  /* на десктопе список открывается наведением (CSS),
     на тач-устройствах — нажатием на кнопку */
  if (dd && trigger) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = dd.classList.toggle("open");
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", () => {
      dd.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dd.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.querySelectorAll(".lang-opt").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      osApplyLang(b.getAttribute("data-lang"));
      if (dd) dd.classList.remove("open");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    })
  );
}

document.addEventListener("DOMContentLoaded", osInitLang);
