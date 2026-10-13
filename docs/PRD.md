# PRD v2 · meshin.co

**Status: frozen 2026-09-06, superseded in places.** Extracted verbatim from
`docs/sources/prd-v2.mhtml`. It records what was asked for at handover, in Russian, and is never
edited to match what was built. Where `docs/plan/reference/locked-decisions.md` (rows L1–L57)
contradicts this document, the locked row wins — and the locked rows contradict it in several
places, including the contact form, the newsletter, prices, and the `/ru` section (L54).

For what the site actually is, read `AGENTS.md` and `openspec/INDEX.md`. Read this document for
the original intent behind a requirement, not for its current shape.

---

PRD v2 · meshin.co — сайт практики Fractional Chief AI Officer

Версия 2.0 · сентябрь 2026 · статус: исполняемый агентом без уточняющих вопросов

Инструкция агенту. Этот документ — единственный источник требований. Все решения уже приняты (см. §2 «Журнал решений»). Если чего-то не хватает — используй значение по умолчанию из §1 «Переменные проекта» или пометь TODO(owner) в коде и продолжай; не останавливайся ради вопроса. Работай по §14 «Процесс разработки» строго по фазам; фаза не считается завершённой, пока не пройден её «Калибровочный гейт». Все ссылки на скиллы — в §13.

0. Оглавление

- Часть A · Бизнес и главная идея (§1–§5)

- Часть B · Продукт: страницы, контент, дизайн (§6–§10)

- Часть C · Техническая спецификация (§11–§13)

- Часть D · Процесс разработки по фазам с калибровкой (§14)

- Часть E · Контент, дистрибуция, эксплуатация (§15–§17)

- Приложения A–J: копирайт, конфиги, схемы, чеклисты

Часть A · Бизнес и главная идея

1. Переменные проекта (заполнить один раз; агент подставляет везде)

OWNER_FIRST_NAME: "Dmitri"
OWNER_SURNAME: "TODO(owner)" # обязательно для Person schema и /about
OWNER_TITLE: "Fractional Chief AI Officer"
BRAND: "meshin.co"
DOMAIN: "meshin.co" # единственный домен, каноничный
LEGAL_ENTITY: "Dmitri TODO(owner) — Esek Patur, Israel"
LOCATION_TEXT: "Israel · remote worldwide"
EMAIL: "hello@meshin.co"
LINKEDIN_PERSON_URL: "TODO(owner)"
LINKEDIN_COMPANY_URL: "TODO(owner)"
GITHUB_ORG_URL: "https://github.com/ctxr-dev"
GITHUB_PERSON_URL: "TODO(owner)"
NPM_ORG_URL: "https://www.npmjs.com/org/ctxr"
CAL_COM_URL: "TODO(owner)" # ссылка на бронирование 30-мин звонка
NEWSLETTER_PROVIDER: "Buttondown" # form action URL: TODO(owner)
ANALYTICS: "Plausible" # data-domain = meshin.co
OG_TWITTER_HANDLE: "" # пусто = не выводить twitter:site
PRIMARY_LOCALE: "en"
SECONDARY_LOCALE: "ru" # фаза 6, не раньше
HERO_PHOTO: "src/assets/images/dmitri.jpg" # если нет — TODO(owner), использовать нейтральный placeholder без лица
PRICE_ASSESSMENT_USD: 4500
PRICE_SPRINT_FROM_USD: 18000
PRICE_RETAINER_FROM_USD_MONTH: 7500

2. Журнал решений (закрыто; не обсуждать)

# |

Решение |
Выбор |
Обоснование |

D1 |
Домен |
meshin.co — единственный и канонический; www → 301 на apex |
Домен принадлежит владельцу; LinkedIn-карточку привести к meshin.co |

D2 |
Титул |
«Fractional Chief AI Officer»; «CEO» не используем до первого P&L-кейса |
Узкий клин продаётся |

D3 |
Рендер |
output: 'static' (SSG), без островов кроме Pagefind |
Индексируемость + бюджеты |

D4 |
View Transitions |
Удалить <ClientRouter /> из Layout |
Несовместим со строгим CSP (см. AGENTS.md AstroWind); сайт контентный, MPA + prefetch достаточно |

D5 |
CSP |
Строгий CSP через _headers, без inline JS кроме JSON-LD (разрешён 'unsafe-inline' только для script-src-elem? Нет: JSON-LD не исполняется, CSP его не блокирует) |
Best Practices 100, security.md скилла |

D6 |
Аналитика |
Plausible (cloud), один async-скрипт < 1 KB |
Без cookies → без баннера |

D7 |
Шрифты |
Заменить Inter на пару: Fraunces (display, 2 начертания: 600/700, opsz) + IBM Plex Sans (text/UI, 400/500) через Astro Fonts API. Моноширинный — системный стек, без загрузки |
Скилл прямо запрещает «Inter on white»; ≤2 семейства / ≤4 начертания |

D8 |
Цвет |
OKLCH-токены: «paper & ink» + один акцент (deep teal). Dark mode — отдельная палитра, не инверсия |
design.md |

D9 |
Поиск |
Pagefind, скрипт грузится по фокусу в поле поиска |
Единственный клиентский JS |

D10 |
Календарь |
Cal.com — ссылка-кнопка (новая вкладка), не embed |
Ноль стороннего JS на странице |

D11 |
Формы |
Статическая HTML-форма → Cloudflare Pages Function /api/contact → email через Resend; honeypot + time-trap; без CAPTCHA |
forms.md, auth.md (CAPTCHA — последний ресурс) |

D12 |
Цены |
Публичные, фиксированные/«от» |
Фильтр и доверие |

D13 |
llms.txt / .md |
Свои endpoints, без плагинов |
50 строк кода, контроль |

D14 |
AI-краулеры |
Разрешены явно (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Bingbot) |
Видимость важнее контроля |

D15 |
Хостинг |
Cloudflare Pages + Pages Functions; DNS Cloudflare |
TTFB, бесплатно, _headers |

D16 |
Изображения |
Только локальные через astro:assets; удалить Unpic и remote domains |
Бюджет, контроль |

D17 |
Partytown |
Удалить |
Нет сторонних скриптов кроме Plausible |

D18 |
astro-compress |
Оставить (конфиг шаблона: csso off, lightningcss on) |
Уже настроен под Tailwind v4 |

D19 |
Блог-URL |
/blog/{slug}; категории /blog/category/{slug}; теги /blog/tag/{slug} noindex |
Хабы индексируем, теги — нет |

D20 |
RU-версия |
Фаза 6; до неё — только en |
Фокус |

D21 |
AstroWind v2 |
Не ждать; стартуем на v1; миграция — отдельный проект после выхода |
Октябрь 2026 — обещание |

D22 |
Кейсы |
Пока нет публичных — раздел /case-studies с одним кейсом only.help (собственный продукт) + шаблон анонимного кейса |
Честность |

D23 |
Тон |
Прямой, инженерный, без «leading/expert/passionate»; числа и даты вместо прилагательных |
§10 |

D24 |
Отзывы |
Нет, пока нет реальных |
Никаких выдуманных |

3. Главная идея (thesis)

Компаниям на 30–300 человек нужен не «AI-консультант со слайдами», а именованный ответственный за AI: человек, который (1) выстраивает governance так, что AI перестаёт блокировать закупки и совет директоров, и (2) собственными руками доводит агентные системы до продакшена с измеримым результатом. Штатный CAIO им не по карману; фракционный — по карману и по масштабу.

Сайт существует, чтобы за 30 секунд убедить три роли (founder, CTO, procurement/compliance) в трёх вещах: ответственность (named person), инженерная глубина (код, evals, архитектура) и дешёвый первый шаг (Assessment за фиксированную цену). Всё остальное на сайте — доказательства этих трёх утверждений.

Одна фраза для hero: AI leadership you can name on the org chart — governance that passes procurement, agents that reach production.

4. Описание бизнеса

4.1 Кто

{{OWNER_FIRST_NAME}} {{OWNER_SURNAME}} — full-stack инженер с 15+ годами, senior platform engineer в компании по fraud detection (1000+ человек), основатель AI-продуктов: платформа оркестрации агентов (Fleet), AI-receptionist для SMB (only.help), open-source скиллы для coding-агентов (@ctxr). Israel, remote. Самозанятый (Esek Patur). Языки: EN, RU, HE.

4.2 Что продаём (три оффера)

Оффер |
Формат |
Цена |
Кому |
Результат |

AI Readiness & Risk Assessment |
2 недели, фикс |
{{PRICE_ASSESSMENT_USD}} USD |
Любая компания ICP, первая точка входа |
Scorecard по 5 драйверам (strategy, data & tech, delivery, people & culture, governance & security), AI-инвентарь, 3 приоритетных процесса с ROI-оценкой, gap-лист по NIST AI RMF / ISO 42001 / EU AI Act, одностраничный board memo |

90-Day Production Sprint |
90 дней, фикс |
от {{PRICE_SPRINT_FROM_USD}} USD |
Есть ≥1 процесс с очевидным ROI |
Один агентный процесс в проде с evals, observability, cost-tracking; governance-минимум (AI register, AUP, data classification, LLM gateway с аудитом); handover внутреннему owner'у; критерий успеха — число в SOW |

Fractional CAIO Retainer |
6–12 мес, 1–2 дня/нед |
от {{PRICE_RETAINER_FROM_USD_MONTH}} USD/мес |
≥3 из 5 сигналов (§4.4) |
Named AI officer: roadmap, комплаенс, ответы закупкам клиентов, надзор за внедрениями, board reporting, формирование внутренней AI-функции и план передачи |

4.3 Кому (ICP)

B2B-компании 30–300 сотрудников, с выручкой, чьи клиенты — корпорации (SaaS, профессиональные услуги, fintech-adjacent, e-commerce с EU-рынком). Гео: Израиль, EU, US (remote), русскоязычные founders. Не работаем: стартапы без выручки; enterprise 5000+; «просто внедрите ChatGPT».

4.4 Квалификация — «5 сигналов»

- Pilot fatigue — много пилотов, ноль в проде.

- Board pressure — совет требует AI-стратегию, некому её сформулировать.

- Governance gap — никто не отвечает за то, как сотрудники используют публичные модели.

- Procurement blocker — клиенты не подписывают, пока не увидят, кто управляет AI-рисками.

- Operating-model gap — деньги на AI тратятся, процессы не меняются.
  ≥3 → retainer; 1–2 → assessment; 0 → не клиент.

4.5 Почему нам поверят (доказательства, которые сайт обязан показать)

- Открытые артефакты: AI Governance Starter Kit, Readiness Scorecard, evals-репо, reference architecture.

- Инженерный бэкграунд с датами и ссылками (GitHub, npm, App Store).

- Собственный /ai-policy — мы делаем для себя то, что продаём.

- Сертификация ISO/IEC 42001 Lead Implementer — как только получена, на /about и в Person schema (hasCredential).

- Кейсы с числами (сначала собственные продукты, потом клиенты).

4.6 Конкуренты и отстройка

Агентства «AI-трансформации» (слайды, без внедрения), фрилансеры-инженеры (внедрение без governance), GRC-платформы (софт без ответственного лица). Наша полка: governance + внедрение + named person в одном лице, для компаний, которым enterprise-консалтинг не по размеру.

5. Цели сайта и метрики

Цель |
Метрика |
6 мес |
12 мес |

Лиды на Assessment |
заявки (форма + Cal) |
2/мес |
6/мес |

Видимость в LLM |
цитирования по 30 buyer prompts (§17.3) |
5/30 |
15/30 |

Поиск |
long-tail в топ-3 (GSC+Bing) |
20 |
50 |

Доказательная база |
скачивания/клоны ресурсов |
50/мес |
200/мес |

Качество |
Lighthouse mobile P/A/BP/SEO на всех шаблонах |
100/100/100/100 |
удержать |

Здоровье |
CrUX «Good» по всем CWV; 0 битых ссылок; 100% индексация |
да |
да |

Часть B · Продукт

6. Персоны и задачи (JTBD)

Персона |
Приходит с |
За 30 секунд должен увидеть |
Путь |

Founder/CEO |
«пилоты не доходят до прода», «совет требует стратегию» |
Что есть человек, берущий ответственность; первый шаг — 2 недели и фикс-цена |
/ → /services/ai-readiness-assessment → Cal |

CTO |
«это инженер или продавец слайдов?» |
Стек, код, evals, архитектурные решения |
/approach → /resources → GitHub |

Procurement/Compliance |
«кто отвечает за AI-риски у поставщика», ISO 42001, EU AI Act |
Готовые governance-артефакты, знание стандартов, формат «named person» |
/resources/ai-governance-starter-kit → /services/fractional-caio |

Партнёр (юрист, агентство) |
«с кем делать совместные проекты» |
Чёткая специализация и границы |
/about → /approach |

LLM/поисковый агент |
вопрос ICP |
Самодостаточный ответ, автор, дата, источники, schema |
любая страница |

Тест каждой страницы: «если LLM прочитает только её, сможет ли он корректно ответить и сослаться на нас?»

7. Информационная архитектура

URL строчные, дефисы, без trailing slash (trailingSlash: false), глубина ≤ 2.

7.1 Карта страниц

URL |
Тип |
Главный запрос |
Schema |
Индекс |

/ |
Home |
fractional chief AI officer |
WebSite, Organization, Person |
да |

/services |
Services hub |
fractional AI officer services |
OfferCatalog, Service×3 |
да |

/services/ai-readiness-assessment |
Offer |
AI readiness assessment |
Service, Offer, FAQPage |
да |

/services/90-day-production-sprint |
Offer |
AI pilot to production |
Service, Offer, FAQPage |
да |

/services/fractional-caio |
Offer |
fractional CAIO retainer |
Service, Offer, FAQPage |
да |

/pricing |
Pricing |
fractional CAIO cost |
Offer×3, FAQPage |
да |

/approach |
Methodology |
AI operating model, governance layer |
Article |
да |

/case-studies |
Hub |
— |
CollectionPage |
да |

/case-studies/{slug} |
Case |
по вертикали |
Article |
да |

/resources |
Hub |
AI governance templates |
CollectionPage |
да |

/resources/{slug} |
Resource |
название артефакта |
CreativeWork / SoftwareSourceCode |
да |

/blog |
Blog list |
— |
Blog, CollectionPage |
да |

/blog/{slug} |
Post |
long-tail |
BlogPosting, BreadcrumbList, FAQPage? |
да |

/blog/category/{governance|agentic-architecture|operating-model|executive} |
Hub с pillar-текстом (≥300 слов) |
pillar |
CollectionPage |
да |

/blog/tag/{tag} |
Tag |
— |
— |
нет |

/glossary |
Glossary |
AI governance glossary |
DefinedTermSet |
да |

/glossary/{term} |
Term |
«what is X» |
DefinedTerm |
да |

/faq |
FAQ |
«do I need a CAIO» |
FAQPage |
да |

/about |
Profile |
{{OWNER_FIRST_NAME}} {{OWNER_SURNAME}} |
ProfilePage, Person |
да |

/now |
Now |
— |
Article |
да |

/speaking |
Speaking |
— |
ItemList, Event |
да |

/newsletter |
Newsletter |
— |
— |
да |

/contact |
Contact |
— |
ContactPage |
да |

/ai-policy |
Policy |
AI acceptable use policy example |
Article |
да |

/security |
Security |
— |
Article |
да |

/privacy, /terms, /imprint |
Legal |
— |
— |
да, низкий приоритет |

/404 |
404 |
— |
— |
нет |

7.2 Машинные интерфейсы

Путь |
Содержимое |
Реализация |

/llms.txt |
Индекс сайта по spec llmstxt.org (Приложение F) |
src/pages/llms.txt.ts из collections |

/llms-full.txt |
Полный текст services, approach, pricing, faq, glossary, resources + 20 последних постов |
src/pages/llms-full.txt.ts |

/{path}.md для blog, resources, glossary, services, approach, faq, pricing, about |
Markdown-версия страницы; в <head> <link rel="alternate" type="text/markdown" href="…"> |
src/pages/[...slug].md.ts + отдельные для статических |

/rss.xml |
Блог (есть в шаблоне) |
оставить |

/feed.json |
JSON Feed 1.1 блог + ресурсы |
src/pages/feed.json.ts |

/sitemap-index.xml |
@astrojs/sitemap, lastmod из updatedDate, исключить /blog/tag/*, /404 |
конфиг |

/robots.txt |
Приложение G |
public/robots.txt |

/.well-known/security.txt |
contact, expires (+1 год), preferred-languages |
public/.well-known/security.txt |

/humans.txt |
автор, стек |
public/humans.txt |

/og/{slug}.png |
1200×630, генерируется на билде |
src/pages/og/[...slug].png.ts через satori + @resvg/resvg-js |

/api/contact |
POST, Pages Function |
functions/api/contact.ts |

8. Контент-модель (src/content.config.ts)

Расширить существующую post-коллекцию и добавить остальные. Все — glob() loader, src/data/{collection}/.

// Общие поля (mixin): title, description (≤155), publishDate, updatedDate (обязательно), draft, noindex?, canonical?, ogImage?
post: shortAnswer (string, 40–60 слов — проверять zod .refine по количеству слов),
fullAnswer (130–170 слов), keyTakeaways (string[3..5]),
faq ({q,a}[0..5]), category (enum 4), tags (string[]),
sources ({title,url}[1..]), author (ref 'author'), relatedResources (ref[]),
series?, image?, imageAlt?
case: client {name?, industry, size}, problem, approach, outcome {metrics {label,value}[1..3]},
stack (string[]), duration, offer (ref 'service'), quote?, anonymized (bool)
service: slug, name, tagline, shortAnswer, price {amount, currency:'USD', unit:'fixed'|'from'|'per-month'},
duration, forWhom (string[]), notForWhom (string[]), deliverables (string[]),
process ({step,title,detail}[]), faq ({q,a}[3..8]), cta {label, href}
resource: type (enum 'template'|'kit'|'scorecard'|'repo'|'checklist'), version, license,
downloadUrl?, repoUrl?, whatInside (string[]), howToUse, relatedPosts (ref[])
glossary: term, shortDefinition (≤50 слов), definition (100–200), relatedTerms (ref[]),
sources ({title,url}[1..])
faq: question, answer (≤80 слов), category (enum 4 | 'general'), relatedPage?
author: name, role, photo, bio, sameAs (url[]), credentials (string[])
speaking: title, event, date, url?, type (enum 'talk'|'podcast'|'article'|'mention')

Zod-правила: updatedDate ≥ publishDate; shortAnswer 40–60 слов; fullAnswer 130–170; description ≤ 155; sources.length ≥ 1 для post/glossary. Нарушение — билд падает.

9. Спецификация страниц (структура + копирайт-скелет)

Полные тексты — Приложение A. Здесь — обязательные блоки в порядке.

9.1 Home /

- Hero (LCP = H1 текст; без картинки над сгибом на mobile): H1 = фраза из §3; подзаголовок 2 строки: кому и что за 90 дней; одна кнопка «Book a 30-min fit call» (Cal.com) + текстовая ссылка «or start with the Assessment →». Под кнопкой — три строки доказательств: «15+ years shipping software · Open-source AI governance kit · ISO/IEC 42001 LI (in progress)».

- «Do you need a Fractional CAIO?» — 5 сигналов как чеклист; строка «3 or more → let's talk».

- Services — три карточки (оффер, цена, срок, одна строка результата, ссылка).

- How I work — 5 драйверов + handover, ссылка на /approach.

- Proof — Starter Kit, Scorecard, Reference Architecture (карточки ресурсов с числами: версия, дата, скачивания).

- Case study — один кейс, три метрики.

- Latest writing — 3 поста (title, shortAnswer первые 2 строки).

- CTA повтор.
  Никаких каруселей, логотипов «trusted by», счётчиков без источника.

9.2 Offer pages ×3

H1 (название) → shortAnswer (для кого + что получите) → таблица: Price / Duration / Format / Start → Deliverables (список, каждый с «формат: PDF/repo/session») → Process (3–6 шагов с длительностью) → «Who this is for / not for» → Sample output (ссылка на образец отчёта — /resources/sample-readiness-report в фазе 4; до этого — описание структуры отчёта) → FAQ (5–8) → CTA.

9.3 Pricing

Таблица трёх офферов + «What moves the price» (размер команды, число систем, регуляторный контекст) + «What's always included» (evals, handover doc, written board memo) + FAQ (оплата, валюта, NDA, IP, что если не подходит после Assessment — «assessment fee credited to Sprint»).

9.4 Approach

Разделы: The problem with AI pilots → The five readiness drivers (таблица с описанием и как измеряем) → The governance layer (AI register, data classification, AUP, vendor assessment, gateway с аудитом; ссылки на NIST/ISO/EU) → The delivery layer (референс-стек одной схемой SVG: UI/API/agents/tools/durable/gateway/models/retrieval/evals/observability) → Measurement (adoption telemetry, cost per outcome) → Handover (SECI, кто становится owner, когда я ухожу) → What I don't do.

9.5 Resources hub + resource page

Hub: карточки с типом, версией, датой, лицензией. Page: что внутри (список файлов), для кого, как использовать (3 шага), ссылка на репо/файл, связанные статьи, changelog. Без gate. Опционально поле email «notify me on updates» (Buttondown).

9.6 Blog post (шаблон цитируемости)

Breadcrumb → H1 → мета (автор · published · updated · N min read) → shortAnswer в <p class="answer"> (визуально выделен, без вводных) → Key takeaways (ul) → TOC (из H2/H3) → тело (H2 как вопросы там, где естественно; абзацы ≤ 4 строк; таблицы для сравнений; код через expressive-code; диаграммы — статичный SVG) → FAQ → Sources (ol) → Author box → Related resources → Related posts → CTA. updatedDate виден. «What changed» — при обновлении.

9.7 Category hub

H1 (название хаба) → pillar-текст ≥300 слов (что это за область, зачем ICP, с чего начать, ссылки на 3 ключевых материала) → список постов → ресурсы хаба.

9.8 Glossary term

H1 «What is {term}?» → shortDefinition (жирно) → definition → «Why it matters for a 30–300 person company» (2–3 предложения) → related terms → sources.

9.9 About

Фото (или placeholder), имя, титул, LOCATION_TEXT → 3 абзаца биографии (инженер → founder → CAIO) → Timeline (годы, роли; факты только из §4.1, остальное TODO(owner)) → Credentials → Stack I ship with → What I don't do → Where to find me (sameAs-ссылки) → CTA.

9.10 FAQ, Now, Speaking, Contact, AI Policy, Security, Legal

- FAQ: 20 вопросов из Приложения C, сгруппированы по 4 хабам + general.

- Now: 5–8 буллетов «чем занят в этом месяце», дата обновления.

- Speaking: список из коллекции; пусто → «No public talks yet. Invite me:» + mailto.

- Contact: форма (name, email, company, company size select, message, honeypot) + Cal-кнопка + email.

- AI Policy: какие инструменты использую, какие данные клиентов никогда не попадают в публичные модели, как логируется, как тестируется сгенерированный код. (Дословный скелет — Приложение A.)

- Security: где хранятся данные (Cloudflare, Resend, Buttondown, Plausible), субпроцессоры, retention, контакт для инцидентов.

- Legal: privacy (Plausible без cookies, форма → Resend, newsletter → Buttondown), terms, imprint (LEGAL_ENTITY).

10. Дизайн-система

10.1 Направление (одна полоса, без отклонений)

«Engineering brief»: издательская, спокойная, документальная. Крупный display-serif для заголовков (Fraunces), нейтральный sans для текста (IBM Plex Sans), моноширинный системный стек для чисел/кода/меток. Много воздуха, тонкие линии, одна акцентная краска. Никаких градиентов, глассморфизма, стоковых иллюстраций, «AI-фиолетового».

10.2 Токены (CustomStyles.astro + tailwind.css @theme)

:root {
--aw-color-bg-page: oklch(98.5% 0.005 90); /* paper _/
--aw-color-text-page: oklch(20% 0.01 260); /_ ink _/
--aw-color-text-muted:oklch(45% 0.01 260);
--aw-color-primary: oklch(45% 0.09 200); /_ deep teal _/
--aw-color-accent: oklch(60% 0.12 200);
--aw-color-line: oklch(88% 0.005 90);
--aw-font-heading: var(--font-fraunces);
--aw-font-sans: var(--font-plex-sans);
--aw-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.dark {
--aw-color-bg-page: oklch(17% 0.01 260);
--aw-color-text-page: oklch(93% 0.005 90);
--aw-color-text-muted:oklch(70% 0.01 260);
--aw-color-primary: oklch(72% 0.10 200); /_ lightened accent for text on dark */
--aw-color-accent: oklch(80% 0.10 200);
--aw-color-line: oklch(28% 0.01 260);
}

Контраст: body ≥ 4.5:1, large ≥ 3:1 — проверять в обеих темах отдельно.

10.3 Типографика

Base 18px / 1.6; шкала 1.25; заголовки Fraunces 600 (H1 clamp(2.2rem, 5vw, 3.5rem), opsz auto); measure 65–75 символов (max-width: 70ch); text-wrap: balance для заголовков, pretty для абзацев. Fonts API: Fraunces weights ['600','700'], IBM Plex Sans weights ['400','500'], subsets latin, fallbacks с metric-adjust (Astro генерирует).

10.4 Компоненты (переиспользовать AstroWind widgets/, стилизовать под токены)

Header (лого-текст, nav 5 пунктов: Services, Approach, Resources, Blog, About; CTA-кнопка «Book a call»; theme toggle), Hero, Signals (чеклист), ServiceCards, StepsTimeline, ResourceCard, CaseMetrics, PostCard, AnswerBlock, KeyTakeaways, TOC, FAQ (native <details>), AuthorBox, Sources, CTA, Footer (nav, legal, sameAs, «Built with Astro · 0 cookies»).

10.5 Состояния и motion

Все интерактивные элементы: hover/focus-visible (2px outline accent, offset 2px)/active. Motion — только transform/opacity, ≤200ms, всё под @media (prefers-reduced-motion: reduce) { * { animation: none; transition: none } }. Никакой hero-анимации.

10.6 Responsive

Брейкпоинты Tailwind; проверка на 320/375/768/1024/1280/1920; scrollbar-gutter: stable; таблицы в overflow-x:auto контейнере; 100dvh вместо 100vh; safe-area для sticky-элементов (их нет по умолчанию).

Часть C · Техническая спецификация

11. Стек и изменения относительно AstroWind

11.1 Оставить

Astro v7, Tailwind v4 (@tailwindcss/vite), MDX, @astrojs/sitemap, astro-icon (tabler), astro-compress (как настроен), vendor/integration (config.yaml), @tailwindcss/typography, tailwind-merge, ESLint/Prettier, Node ≥ 22.22.3, .nvmrc.

11.2 Удалить

<ClientRouter /> из Layout.astro (D4); @astrojs/partytown и hasExternalScripts (D17); GA-интеграцию в Analytics.astro (заменить на Plausible); unpic и image.domains (D16); демо-контент (src/data/post/* примеры, демо-страницы landing/_, homes/_, pricing.astro демо — заменить своими); flat-color-icons; netlify.toml, vercel.json, Dockerfile, docker-compose.yml, nginx/ (хостинг — Cloudflare).

11.3 Добавить

Пакет / файл |
Назначение |

astro-expressive-code |
код в статьях |

pagefind + astro-pagefind (или ручной postbuild npx pagefind --site dist) |
поиск |

satori, @resvg/resvg-js |
OG-картинки на билде |

rehype-mermaid (strategy img-svg, рендер на билде) или ручные SVG |
диаграммы без runtime |

rehype-external-links (rel="noopener", target не менять) |
гигиена ссылок |

rehype-slug, rehype-autolink-headings |
якоря для TOC |

schema-dts |
типизированный JSON-LD |

@lhci/cli, @axe-core/cli или playwright + @axe-core/playwright, html-validate, linkinator, size-limit |
CI-гейты |

functions/api/contact.ts + resend |
форма |

src/pages/llms.txt.ts, llms-full.txt.ts, feed.json.ts, [...slug].md.ts, og/[...slug].png.ts |
машинные интерфейсы |

public/_headers, public/_redirects |
CSP/HSTS/кэш; www.meshin.co/* https://meshin.co/:splat 301 (Bulk Redirect на уровне Cloudflare) |

scripts/indexnow.mjs |
пинг IndexNow после деплоя (ключ в env) |

scripts/validate-llms.mjs |
проверка ссылок llms.txt |

.github/workflows/ci.yml |
Приложение H |

lighthouserc.cjs |
Приложение H |

.agents/skills/ |
скиллы §13 |

AGENTS.md |
дополнить (Приложение I) |

11.4 src/config.yaml (ключевые значения)

site: { name: 'meshin.co', site: 'https://meshin.co', base: '/', trailingSlash: false, googleSiteVerificationId: 'TODO(owner)' }
metadata:
title: { default: 'Fractional Chief AI Officer — meshin.co', template: '%s — meshin.co' }
description: 'Fractional AI leadership for 30–300 person companies: AI governance that passes procurement and agentic automation shipped to production.'
robots: { index: true, follow: true }
openGraph: { site_name: 'meshin.co', images: [{ url: '~/assets/images/og-default.png', width: 1200, height: 630 }], type: website }
i18n: { language: en, textDirection: ltr }
apps.blog: { isEnabled: true, postsPerPage: 12, post.permalink: '/blog/%slug%', list.pathname: 'blog', category: { pathname: 'blog/category', robots.index: true }, tag: { pathname: 'blog/tag', robots.index: false }, isRelatedPostsEnabled: true, relatedPostsCount: 3 }
analytics.vendors.googleAnalytics.id: null # Plausible подключается в Analytics.astro
ui.theme: 'system'

11.5 <head> каждой страницы (через Metadata.astro)

title (≤60), description (≤155), canonical, robots, OG (type, title, description, image 1200×630, url, site_name, locale), Twitter card summary_large_image, <link rel="alternate" type="application/rss+xml">, <link rel="alternate" type="application/feed+json">, <link rel="alternate" type="text/markdown"> (на страницах с сайдкаром), theme-color ×2 (light/dark), favicons (svg + png + apple-touch), <script type="application/ld+json"> с @graph. Preload шрифтов — Fonts API сам.

11.6 Structured data — один граф (src/utils/jsonld.ts)

Узлы с @id: https://meshin.co/#org (Organization: name, url, logo, founder→#person, sameAs [LINKEDIN_COMPANY_URL, GITHUB_ORG_URL, NPM_ORG_URL], contactPoint), #person (Person: name, jobTitle, worksFor→#org, url /about, image, sameAs [LINKEDIN_PERSON_URL, GITHUB_PERSON_URL, NPM], knowsAbout [ISO/IEC 42001, NIST AI Risk Management Framework, EU AI Act, Model Context Protocol, agentic systems, LLM evaluation], hasCredential — когда есть), #website (WebSite: potentialAction SearchAction /search?q={search_term_string}), Service (/services/*#service, provider→#org, offers→Offer с priceSpecification), BlogPosting (author→#person, publisher→#org, dateModified, about→DefinedTerm, citation), FAQPage, DefinedTermSet/DefinedTerm, BreadcrumbList, ProfilePage (/about), CollectionPage (хабы). Валидация в CI: schema-dts типы + structured-data-testing-tool (или Rich Results API) на 6 шаблонных страницах.

11.7 Безопасность (public/_headers, Приложение G)

CSP: default-src 'self'; script-src 'self' https://plausible.io; connect-src 'self' https://plausible.io; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline' (Tailwind v4 не требует inline, но astro-compress может — проверить; цель — убрать 'unsafe-inline' для style-src, если билд чист); frame-ancestors 'none'; base-uri 'self'; form-action 'self'. HSTS preload, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy (camera, microphone, geolocation = ()), Cross-Origin-Opener-Policy: same-origin. Кэш: /_astro/* immutable 1y; HTML max-age=0, must-revalidate.

11.8 Производительность — бюджеты (из скилла, ужесточены под контентный сайт)

Метрика |
Mobile |
Desktop |

Lighthouse P / A / BP / SEO |
100 / 100 / 100 / 100 (допуск P ≥ 97 при сетевом шуме — фиксировать) |
100 / 100 / 100 / 100 |

LCP / INP / CLS / TTFB / FCP / TBT |
<1.8s / <100ms / <0.02 / <500ms / <1.0s / 0ms |
<1.2s / <100ms / <0.02 / <400ms / <0.8s / 0ms |

JS initial (gz) |
< 10 KB (Plausible + theme toggle); Pagefind — только по фокусу |
то же |

CSS initial (gz) |
< 20 KB |
то же |

Шрифты |
2 семейства / 4 начертания, subset latin, ≤ 120 KB total |
то же |

Page weight (без изображений) |
< 250 KB |
то же |

Изображения above-the-fold |
0 на mobile home; ≤1 на about |
|

Любое превышение — блокер, а не «полировка». |
|
|

12. Эксплуатация

- Деплой: push в main → GitHub Actions CI → Cloudflare Pages (direct upload через wrangler pages deploy dist) → scripts/indexnow.mjs.

- Превью: каждый PR → Cloudflare preview URL; CI гоняет Lighthouse на preview.

- Секреты (GitHub Secrets / CF env): RESEND_API_KEY, CONTACT_TO_EMAIL, INDEXNOW_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.

- Мониторинг: GSC, Bing Webmaster (импорт из GSC + IndexNow), CrUX Dashboard, Cloudflare Analytics, Plausible goals (book_call, download_resource, contact_submit, newsletter_submit), uptime (Cloudflare или UptimeRobot).

- Регулярно: еженедельно — GSC coverage; ежемесячно — buyer prompts (§17.3), обновить /now; ежеквартально — полный Polish Loop скилла + SEO-аудит скиллом, пересмотр зависимостей, проверка AstroWind v2.

13. Скиллы и порядок их применения

# |

Скилл |
Установка |
Когда |

S1 |
ctxr-dev/skill-frontend-excellence |
npx @ctxr/kit@latest install @ctxr/skill-frontend-excellence (→ .agents/skills/skill-frontend-excellence/, симлинк в .claude/skills/) |
Всегда активен. Workflow: Frame → Plan → Build with budgets → Verify. Калибровочный гейт каждой фазы = его Multi-Page Polish Loop (19 фаз) + чеклист Self-Improvement. Загружать по Routing-таблице не более 3 references за раз |

S2 |
AstroWind .agents/skills/ |
уже в шаблоне |
Перед любым структурным изменением шаблона (отключение блога, OG, header, деплой) |

S3 |
AgriciDaniel/claude-seo |
по README репо (в .claude/skills/) |
Фаза 3 (schema, technical SEO), Фаза 5 (citability-скоринг статей), ежеквартальный аудит. Использовать его reframes: GEO = SEO, llms.txt — не рычаг ранжирования |

S4 |
zubair-trabzada/geo-seo-claude |
по README |
Фаза 3: geo-llmstxt для проверки llms.txt против spec, geo-crawlers для robots |

S5 |
Anthropic frontend-design (встроенный в Claude Code) |
— |
Фаза 2: hero, типографика, отход от шаблонного вида |

S6 |
Context7 MCP (подключён) |
— |
Любой вопрос по Astro v7 / Tailwind v4 / Pagefind / satori API — сначала Context7, не память |

Разрешение конфликтов: S1 > S2 > S3/S4 > S5, кроме случаев, когда S3 указывает на индексируемость (тогда S3 > S5). Priority Stack S1 (crawlability → a11y → CWV → layout → hierarchy → interaction → forms → motion → data → polish) — единый порядок приоритетов для всего проекта.

Часть D · Процесс разработки

14. Фазы, шаги, калибровочные гейты

14.0 Общие правила процесса

- Ветка на фазу: phase-N-<slug>; PR в main; merge только при зелёном CI и пройденном гейте.

- Каждая фаза заканчивается Калибровочным гейтом (КГ): одинаковая процедура, разный набор маршрутов. Процедура — §14.9.

- Рендер в браузере — источник истины: скриншоты 1440x900 и 375x812 до/после, папка audits/phase-N/.

- Вносить в audits/phase-N/REPORT.md таблицу: маршрут → найдено → исправлено → до/после → Lighthouse.

- Не переходить к следующей фазе с открытыми блокерами. Любое отклонение от бюджета — только как записанный waiver в audits/WAIVERS.md с обоснованием (ожидаемо: ноль waiver'ов).

Фаза 0 · Инициализация (≈ 0.5 дня)

- npm create astro@latest -- --template arthelokyo/astrowind meshin-co; Node из .nvmrc; npm i; npm run build — убедиться, что шаблон собирается «как есть»; сохранить baseline Lighthouse шаблона в audits/phase-0/baseline/.

- Установить S1 (npx @ctxr/kit@latest install @ctxr/skill-frontend-excellence), S3, S4 в .agents/skills/ / .claude/skills/. Прочитать SKILL.md S1 целиком; из references — quick-reference.md, anti-patterns.md.

- Дополнить AGENTS.md (Приложение I); создать CLAUDE.md → ссылка на AGENTS.md.

- Создать audits/, docs/DECISIONS.md (скопировать §2), docs/PRD.md (этот документ).

- Git init, .github/workflows/ci.yml (Приложение H) в режиме «только build + check» — гейты включаются в Фазе 1.
  Выход: шаблон собирается; скиллы установлены; baseline снят.

Фаза 1 · Каркас и инфраструктура (≈ 1.5 дня)

- Чистка по §11.2: удалить ClientRouter, Partytown, Unpic, GA, демо-страницы и демо-посты, лишние хостинг-файлы. npm run build зелёный после каждого удаления.

- Конфиг src/config.yaml по §11.4; src/navigation.ts (header: Services, Approach, Resources, Blog, About + CTA; footer: 4 колонки — Services / Resources / Company / Legal + sameAs).

- Шрифты: заменить Inter в astro.config.ts fonts на Fraunces + IBM Plex Sans (D7); обновить CustomStyles.astro.

- Токены §10.2 в CustomStyles.astro и tailwind.css @theme; удалить неиспользуемые цвета.

- Layout.astro: <head> по §11.5 (расширить Metadata.astro: alternate feeds, markdown alternate, theme-color ×2), skip-link, <main id="main">, footer.

- Plausible в Analytics.astro: <script defer data-domain="meshin.co" src="https://plausible.io/js/script.outbound-links.file-downloads.js">.

- public/_headers (Приложение G), robots.txt, security.txt, humans.txt, favicons (svg-первый), og-default.png временный.

- CI: включить полный ci.yml (build, check, Lighthouse CI на /, /404, axe, html-validate, linkinator, size-limit). lighthouserc.cjs с assertions по §11.8.

- Cloudflare Pages проект, env, wrangler pages deploy dist из CI; подключить домен meshin.co (apex; www → 301 на apex).

- Страницы-заглушки: /, /404 с финальной структурой, но временным текстом «TODO(copy)».
  Калибровочный гейт КГ-1 на маршрутах /, /404. Особое внимание: font-swap CLS (metrics-override), CSP без нарушений в консоли, JS ≤ 10 KB.
  Выход: пустой сайт в проде на 100/100/100/100 mobile+desktop; CSP строгий; Plausible пишет; CI блокирует регрессии.

Фаза 2 · Дизайн-система и компоненты (≈ 2 дня)

- Frame (по S1 Workflow §1): аудитория §6, индексируемость — всё индексируемо, направление §10.1, SSG.

- Применить S5 (frontend-design) для hero и типографической шкалы; зафиксировать результат как токены/классы, не как inline-стили.

- Реализовать компоненты §10.4, переиспользуя widgets/ AstroWind (Hero, Features→Signals, Pricing→ServiceCards, Steps→StepsTimeline, FAQs, CallToAction, Footer); новые: AnswerBlock, KeyTakeaways, TOC, Sources, AuthorBox, ResourceCard, CaseMetrics, SearchBox (Pagefind, lazy).

- Страница /styleguide (noindex, robots: false, исключить из sitemap) — все компоненты во всех состояниях, обе темы. Используется гейтами как «widget inventory».

- Состояния: hover/focus-visible/active/disabled; reduced-motion; dark mode проверен отдельно.

- Собрать / с финальной структурой §9.1 и копирайтом Приложения A.
  КГ-2 на /, /styleguide, /404. Из S1 загрузить design.md, components.md, responsive.md; провести фазы 3 (widget inventory), 11 (geometry sweep), 12 (drift) Polish Loop. Контраст обеих тем через axe + ручной OKLCH-чек.
  Выход: дизайн-система стабильна; главная — финальная; 100/100/100/100.

Фаза 3 · Контент-модель, шаблоны, машинные интерфейсы (≈ 2.5 дня)

- src/content.config.ts по §8 с zod-refine; папки src/data/{post,case,service,resource,glossary,faq,author,speaking}; author/dmitri.md.

- Шаблоны: PostLayout (§9.6), ServicePage (§9.2), ResourcePage, CasePage, GlossaryTermPage, CategoryHub (§9.7), FaqPage, ProfilePage.

- src/utils/jsonld.ts — граф §11.6; типизация schema-dts; вставка через Metadata.astro.

- Endpoints §7.2: llms.txt.ts, llms-full.txt.ts, feed.json.ts, [...slug].md.ts (рендер markdown-тела из collection entry + фронтматтер как заголовок/мета), og/[...slug].png.ts (satori: шаблон с названием, категорией, брендом; шрифт Fraunces из node_modules/@fontsource), sitemap filter/lastmod.

- rehype/remark цепочка: slug, autolink headings, external links, mermaid→svg (build-time), expressive-code; readingTime (есть в шаблоне).

- Pagefind: postbuild pagefind --site dist; /search страница; индексировать только <main> (data-pagefind-body).

- Contact: functions/api/contact.ts (валидация, honeypot website, time-trap ≥3s, Resend, JSON-ответ, редирект на /contact/thanks noindex), форма по forms.md S1 (labels, autocomplete, inline errors через Constraint Validation без JS-библиотек — допустим ≤1 KB прогрессивный скрипт).

- Наполнить минимальный контент, чтобы каждый шаблон рендерился: 1 пост-образец (реальный, из §15 нед. 2), 3 сервиса (Приложение A), 1 ресурс (Scorecard — описание + ссылка на репо/PDF TODO(owner)), 1 кейс (only.help, anonymized:false), 10 терминов, 20 FAQ, /about, /approach, /pricing, /faq, /ai-policy, /security, /privacy, /terms, /imprint, /now, /speaking, /newsletter, /contact.

- Применить S3 (seo-schema, seo-technical) и S4 (geo-llmstxt, geo-crawlers): исправить всё найденное.
  КГ-3 на всех шаблонных маршрутах: /, /services, /services/ai-readiness-assessment, /pricing, /approach, /resources, /resources/{1}, /case-studies/{1}, /blog, /blog/{1}, /blog/category/governance, /glossary, /glossary/{1}, /faq, /about, /contact, /search, /404. Плюс: JSON-LD валиден на каждом; .md-сайдкары 200; llms.txt валиден; feed.json валиден; форма проходит keyboard + screen-reader; sitemap без noindex-страниц.
  Выход: сайт функционально полон; каждый тип страницы — 100/100/100/100.

Фаза 4 · Контент ядра и ресурсы (≈ 3 дня работы агента + правки owner)

- Дописать все тексты Приложения A до финала; факты об owner'е вне §4.1 — TODO(owner).

- Ресурсы (страницы + артефакты в GitHub ctxr-dev/): ai-governance-starter-kit (AUP, data classification, vendor questionnaire, AI register, incident response — как Markdown-шаблоны), ai-readiness-scorecard (таблица 5×4 + инструкция), agent-evals-ci-starter (promptfoo + пример), llm-gateway-governance-config (LiteLLM proxy + политики), build-vs-buy-kit (таблица TCO 3 года). README каждого репо ссылается на страницу ресурса.

- Статьи недель 2–4 из §15 (3 шт.) по шаблону §9.6 с полным соблюдением §8.

- Глоссарий до 30 терминов; FAQ до 25.

- /resources/sample-readiness-report — обезличенный образец (структура + пример заполнения).

- Прогнать S3 seo-content/citability по каждой статье: shortAnswer самодостаточен, H2-вопросы, источники, entity-упоминания.
  КГ-4 на всех новых маршрутах + повтор 6 шаблонных. Дополнительно: проверка орфографии (cspell), читаемость (measure, длина абзацев), внутренние ссылки ≥2 входящих на каждую статью.
  Выход: контент ядра готов к индексации.

Фаза 5 · Запуск и индексация (≈ 0.5 дня + ожидание)

- Финальный полный Polish Loop S1 (все 19 фаз) на всех маршрутах; pre-launch.md чеклист; Self-Improvement чеклист — все ответы «да».

- robots.txt — снять любые временные Disallow; sitemap отправлен в GSC и Bing; IndexNow пинг; LinkedIn-профиль и компания → ссылки на сайт; GitHub org profile README → сайт.

- Базовый замер §17.3 (30 buyer prompts) → audits/geo-baseline.md.

- Включить Plausible goals; проверить события.
  КГ-5: production URL, не preview; CrUX пока пуст — Lighthouse throttled mobile/desktop на 10 маршрутах, три прогона, медиана.
  Выход: сайт публичен, проиндексирован, замеры сняты.

Фаза 6 · Рост (циклично, каждые 2 недели)

- Статьи по §15; ресурсы по мере готовности артефактов Master Plan.

- Обновление старых статей (updatedDate, «What changed»).

- Ежемесячно — buyer prompts, /now; ежеквартально — Polish Loop + S3-аудит + зависимости + проверка AstroWind v2 (миграция — отдельный PRD).

- ~~RU-раздел (/ru/)~~ — **superseded by L54 on 2026-09-15: English only, no second language.**
  КГ на каждый PR — автоматический (CI) + ручной Polish Loop на изменённых маршрутах.

14.9 Калибровочный гейт (КГ) — единая процедура

1. npm run build && npm run check # ноль ошибок/предупреждений
2. npm run preview (или dist на локальном static-сервере) # Lighthouse только на production build
3. Lighthouse CI: mobile + desktop, 3 прогона, медиана, все маршруты фазы
   → все категории 100 (P допуск ≥97 с записью причины); все assertions lighthouserc пройдены
4. axe-core на каждом маршруте, light + dark → 0 violations
5. html-validate → 0 errors; linkinator → 0 broken; size-limit → в бюджете
6. JSON-LD: валидация всех страниц; все @id резолвятся; Rich Results test на 1 странице каждого типа
7. Скриншоты 1440x900 и 375x812, light + dark, → audits/phase-N/after/
8. S1 Polish Loop (audit-workflow.md): фазы 2 (routes), 3 (widgets), 6 (audit each), 11 (geometry sweep + content-and-markup sweep), 12 (drift), 13 (interaction QA), 14 (a11y), 15 (Lighthouse polish), 19 (acceptance)
9. Ручной проход: 320/375/768/1024/1280/1920; prefers-reduced-motion; keyboard-only; VoiceOver/NVDA на primary task (найти оффер → CTA; прочитать статью)
10. Self-Improvement чеклист S1 — все «да»
11. REPORT.md фазы заполнен; waiver'ов нет (или записаны)
    → Только после этого: PR → merge → deploy

Часть E · Контент, дистрибуция, эксплуатация

15. Контент-план 90 дней

Нед. |
Хаб |
Материал (URL slug) |
Артефакт |

1 |
— |
Ядро сайта (Фазы 1–3) |
ai-readiness-scorecard |

2 |
governance |
ai-system-register-how-to-build-one-in-a-week |
AI Register template |

3 |
governance |
ai-acceptable-use-policy-template-50-person-company |
AUP template |

4 |
agentic-architecture |
evals-in-ci-for-llm-agents-promptfoo |
agent-evals-ci-starter |

5 |
operating-model |
why-ai-pilots-never-reach-production-five-signals |
Scorecard |

6 |
governance |
eu-ai-act-deployer-obligations-small-b2b-company |
EU AI Act checklist |

7 |
agentic-architecture |
llm-gateway-as-governance-control-litellm |
llm-gateway-governance-config |

8 |
executive |
build-vs-buy-ai-three-year-tco-template |
build-vs-buy-kit |

9 |
glossary |
+20 терминов (до 30) |
— |

10 |
governance |
iso-42001-for-companies-without-compliance-team |
Gap-assessment sheet |

11 |
case |
Кейс only.help (метрики: время ответа, deflection, стоимость на диалог) |
— |

12 |
operating-model |
adoption-telemetry-measuring-if-ai-is-actually-used |
Dashboard template |

13 |
executive |
handing-over-ai-leadership-to-an-internal-owner |
Handover Playbook |

Редакционные правила: см. §8 (zod) + Приложение J (чеклист публикации). Факты о стандартах — только с первоисточниками (nist.gov, iso.org, eur-lex, owasp.org). Даты и сроки EU AI Act — проверять на дату публикации.

16. Дистрибуция и построение сущности

- LinkedIn: пост под каждый материал (тезис + ссылка на страницу, не на главную); компания meshin.co → сайт; профиль → /about.

- GitHub ctxr-dev: README ресурсов → страницы ресурсов; org profile README → сайт.

- npm @ctxr: README → сайт.

- Подкасты/митапы: 1 в квартал; страница /speaking; просить ссылку на /about.

- Reddit/HN/Indie Hackers: ответы по существу со ссылкой на конкретную статью.

- Гостевые материалы: 2 в полгода (блоги Pydantic, Temporal, Langfuse, dev.to).

- Каталоги fractional-исполнителей: 5 штук.

- Newsletter раз в 2 недели: одна мысль + один артефакт.

17. Измерение

17.1 Инструменты

GSC, Bing Webmaster (+IndexNow), CrUX, Plausible (goals), Lighthouse CI история в audits/, Ahrefs Webmaster Tools (бесплатно) для бэклинков.

17.2 Еженедельный отчёт (автогенерация скриптом — фаза 6)

Индексация, топ-запросы, CWV, лиды, скачивания, новые бэклинки.

17.3 Buyer prompts (30, проверять в ChatGPT, Claude, Perplexity, Gemini, Google AI Mode; фиксировать «упомянут/процитирован/нет»)

- who is a fractional chief AI officer for a 100-person SaaS company · 2. fractional CAIO vs full-time CAIO cost · 3. AI readiness assessment template for SMB · 4. AI governance consultant ISO 42001 small company · 5. named person responsible for AI risk in vendor procurement · 6. how to build an AI system register · 7. AI acceptable use policy template · 8. EU AI Act obligations for deployers small business · 9. why do AI pilots fail to reach production · 10. LLM gateway for governance and audit · 11. how to put evals for AI agents into CI · 12. AI vendor assessment questionnaire template · 13. build vs buy AI 3-year TCO · 14. AI operating model for mid-size company · 15. how to hand over AI leadership to internal team · 16. fractional AI officer Israel · 17. fractional AI leader Europe remote · 18. agentic automation consultant for B2B · 19. MCP security best practices · 20. multi-agent reference architecture production · 21. adoption telemetry for AI tools · 22. AI incident response plan template · 23. data classification for LLM usage · 24. ISO 42001 gap assessment · 25. NIST AI RMF for small companies · 26. fractional CAIO pricing · 27. what does a chief AI officer do in a 50 person company · 28. AI governance starter kit open source · 29. AI readiness scorecard five drivers · 30. board memo AI strategy one page.

Приложения

Приложение A · Копирайт ядра (EN; owner правит факты)

Home / Hero
H1: AI leadership you can name on the org chart.
Sub: Fractional Chief AI Officer for 30–300 person companies. I build the governance that gets you through enterprise procurement and ship agentic systems that actually reach production — with evals, observability and a number in the contract.
CTA: Book a 30-min fit call · link: or start with the 2-week Assessment →
Proof line: 15+ years shipping software · Open-source AI Governance Starter Kit · ISO/IEC 42001 Lead Implementer (in progress)

Home / Signals — H2: Do you need a Fractional CAIO?

- You've run several AI pilots and none is in production.

- Your board or investors are asking for an AI strategy and nobody owns it.

- Nobody can say which company data employees are pasting into public models.

- A customer's procurement team asked who is accountable for your AI risks — and the deal stalled.

- AI budget is being spent, but no process has actually changed.
  Three or more? That's the profile I work with.

Services / short answers

- Assessment: Two weeks, fixed price. I interview leadership, inventory every AI use in the company, score you on five readiness drivers, map gaps against NIST AI RMF, ISO/IEC 42001 and the EU AI Act, and hand you three prioritized processes with ROI estimates and a one-page board memo. If we continue, the fee is credited toward the Sprint.

- Sprint: Ninety days to take one process from pilot to production: an agentic system with evals in CI, tracing, cost per outcome, and a governance minimum — AI register, acceptable-use policy, data classification, an LLM gateway with audit logs. The success criterion is a number written into the SOW.

- Retainer: One to two days a week as your named AI officer: roadmap, compliance, answers to your customers' security questionnaires, oversight of every AI initiative, board reporting, and a plan to hand the function to an internal owner within 12–24 months.

About / opening
I'm {{OWNER_FIRST_NAME}}, a full-stack engineer with 15+ years of shipping software and a senior platform engineer at a 1000+ person fraud-detection company by day. I've built and run my own AI products — an agent orchestration platform, an AI receptionist for small businesses, an App Store planner — and I publish open-source skills and templates for AI-assisted engineering. Since 2025 I've worked with companies as a fractional AI leader: the person accountable for governance and for getting agents into production. Based in Israel, working remotely with teams in Europe, the US and Israel.

AI Policy / skeleton — H1: How I use AI in my own work → Tools I use (list) → Data that never goes to public models (client source code, credentials, personal data, unreleased financials; how I enforce it: gateway, local models, redaction) → Logging and retention → How AI-generated code is reviewed and tested → What I disclose to clients → Last reviewed: {date}.

FAQ (20 стартовых) — Приложение C.

Приложение B · Схема referenced stack для /approach (SVG, статичный)

Слои сверху вниз: Users/UI → API → Agents (typed, graph) → Tools via MCP (least privilege) → Durable execution → LLM Gateway (audit, budgets, fallback, DLP) → Models (frontier API | open-weight in-perimeter) → Retrieval (Postgres+pgvector, reranker) → Memory → Evals (CI) & Observability (OTel) как боковая шина → Governance (register, policies, ISO 42001) как рамка вокруг всего.

Приложение C · FAQ (20)

- What is a fractional Chief AI Officer? 2. How is this different from an AI consultant or agency? 3. Who is this for — and who is it not for? 4. What happens in the 2-week Assessment? 5. What do I get at the end of the Assessment? 6. What does the 90-Day Sprint deliver? 7. How do you measure success? 8. What is an AI system register and why do I need one? 9. Do we need ISO/IEC 42001? 10. Does the EU AI Act apply to a company like ours? 11. Which AI tools and models do you use? 12. Can everything stay inside our infrastructure? 13. How do you handle our data and IP? 14. How do you work with our existing engineering team? 15. What happens when the engagement ends? 16. How do you price, and what affects the price? 17. Do you work under NDA? 18. Which time zones and languages do you work in? 19. Can you help us answer our customers' AI security questionnaires? 20. Why should we trust you?
  Каждый ответ ≤80 слов, самодостаточен, со ссылкой на страницу-источник.

Приложение D · Заготовки схем JSON-LD

См. §11.6; шаблон в src/utils/jsonld.ts с функциями orgNode(), personNode(), websiteNode(), serviceNode(service), postNode(post), faqNode(items), breadcrumbNode(items), termNode(term), profilePageNode(), collectionNode(); страница вызывает graph([...]).

Приложение E · _redirects / домены

Единственный домен — meshin.co (apex). www.meshin.co → Cloudflare Bulk Redirect https://www.meshin.co/* → https://meshin.co/$1 (301). Старые URL (если появятся при реструктуризации) — в public/_redirects.

Приложение F · /llms.txt (шаблон endpoint'а)

# meshin.co — Fractional Chief AI Officer ({{OWNER_FIRST_NAME}} {{OWNER_SURNAME}})

> Fractional AI leadership for 30–300 person B2B companies: AI governance
> (NIST AI RMF, ISO/IEC 42001, EU AI Act) and agentic systems shipped to
> production with evals and observability. Israel, remote worldwide.

## Services

- [AI Readiness & Risk Assessment](https://meshin.co/services/ai-readiness-assessment.md): 2 weeks, fixed price, five-driver scorecard and board memo
- [90-Day Production Sprint](https://meshin.co/services/90-day-production-sprint.md): one process to production with evals and governance minimum
- [Fractional CAIO Retainer](https://meshin.co/services/fractional-caio.md): named AI officer, 1–2 days/week

## How I work

- [Approach](https://meshin.co/approach.md)
- [Pricing](https://meshin.co/pricing.md)
- [FAQ](https://meshin.co/faq.md)

## Open-source resources

{{ for resource: - [title](url.md): one-line }}

## Recent articles

{{ last 20 posts: - [title](url.md): shortAnswer first sentence }}

## Optional

- [Glossary](https://meshin.co/glossary.md)
- [About](https://meshin.co/about.md)
- [Full content](https://meshin.co/llms-full.txt)

Приложение G · public/_headers и robots.txt

/*
Content-Security-Policy: default-src 'self'; script-src 'self' https://plausible.io; connect-src 'self' https://plausible.io; img-src 'self' data:; font-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
X-Frame-Options: DENY
/_astro/*
Cache-Control: public, max-age=31536000, immutable
/og/*
Cache-Control: public, max-age=604800
/*.html
Cache-Control: public, max-age=0, must-revalidate

Если билд требует inline <style> — добавить 'unsafe-inline' в style-src только после подтверждения, что 'self' ломает рендер, и записать waiver.

# robots.txt

User-agent: *
Allow: /
Disallow: /blog/tag/
Disallow: /search
Disallow: /contact/thanks
Disallow: /styleguide

User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: CCBot
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: https://meshin.co/sitemap-index.xml

Приложение H · CI (.github/workflows/ci.yml, lighthouserc.cjs) — скелет

name: ci
on: [push, pull_request]
jobs:
build:
runs-on: ubuntu-latest
steps:

- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version-file: .nvmrc, cache: npm }
- run: npm ci
- run: npm run check
- run: npm run build
- run: npx pagefind --site dist
- run: npx html-validate "dist/**/*.html"
- run: npx linkinator dist --recurse --skip "plausible.io|linkedin.com"
- run: npx size-limit
- run: node scripts/validate-llms.mjs dist
- run: node scripts/validate-jsonld.mjs dist
- run: npx playwright install --with-deps chromium && node scripts/axe.mjs dist
- run: npx lhci autorun
- uses: actions/upload-artifact@v4
  with: { name: audits, path: .lighthouseci }
  deploy:
  needs: build
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version-file: .nvmrc, cache: npm }
- run: npm ci && npm run build && npx pagefind --site dist
- run: npx wrangler pages deploy dist --project-name meshin-co
  env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}, CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }} }
- run: node scripts/indexnow.mjs
  env: { INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }} }

// lighthouserc.cjs
module.exports = {
ci: {
collect: {
staticDistDir: './dist',
url: ['/', '/services/ai-readiness-assessment', '/pricing', '/approach', '/blog', '/blog/<first-post>', '/resources', '/glossary', '/about', '/contact', '/404'],
numberOfRuns: 3,
settings: { preset: 'desktop' } // второй набор — mobile по умолчанию; два collect-конфига или матрица
},
assert: {
assertions: {
'categories:performance': ['error', { minScore: 0.97 }],
'categories:accessibility': ['error', { minScore: 1 }],
'categories:best-practices': ['error', { minScore: 1 }],
'categories:seo': ['error', { minScore: 1 }],
'largest-contentful-paint': ['error', { maxNumericValue: 1800 }],
'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
'total-blocking-time': ['error', { maxNumericValue: 50 }],
'resource-summary:script:size': ['error', { maxNumericValue: 10240 }],
'resource-summary:stylesheet:size': ['error', { maxNumericValue: 20480 }],
}
},
upload: { target: 'filesystem', outputDir: './.lighthouseci' }
}
};

Приложение I · Дополнение к AGENTS.md

## Project: meshin.co (see docs/PRD.md — single source of truth)

- Skills priority: skill-frontend-excellence > AstroWind skills > claude-seo/geo-seo > frontend-design. Load ≤3 references from frontend-excellence at a time via its routing tables.
- Every phase ends with the Calibration Gate in docs/PRD.md §14.9. No merge without a green gate and audits/phase-N/REPORT.md.
- Budgets (blocking): mobile Lighthouse 100/100/100/100 (perf ≥97 with recorded reason), JS ≤10 KB gz, CSS ≤20 KB gz, CLS ≤0.02, LCP ≤1.8s.
- No client JS except Plausible, theme toggle, lazy Pagefind. No ClientRouter. No third-party embeds. No cookies.
- Content rules: every post/glossary/service has shortAnswer, updatedDate, sources; zod enforces; build fails otherwise.
- Copy tone: direct, engineering, numbers and dates over adjectives; never invent client names, testimonials, metrics. Unknown owner facts → TODO(owner).
- Design lane: "engineering brief" (Fraunces + IBM Plex Sans, paper/ink + deep teal OKLCH). No gradients, no stock imagery, no purple.
- Structured data: single @graph per page via src/utils/jsonld.ts; every node has @id; validate in CI.
- Machine interfaces: /llms.txt, /llms-full.txt, /{page}.md, /feed.json, /rss.xml, /og/*.png are build outputs — verify in dist, not in source.
- Use Context7 for Astro/Tailwind/Pagefind/satori API questions before relying on memory.

Приложение J · Чеклист публикации материала

- H1 содержит вопрос/утверждение с ключевым запросом; запрос в первых 100 словах

- shortAnswer 40–60 слов, fullAnswer 130–170, без «в этой статье»

- 3–5 key takeaways; ≥1 таблица или схема; ≥3 первоисточника

- FAQ 2–5; JSON-LD валиден; breadcrumb; author sameAs

- updatedDate; OG-картинка в dist; .md-сайдкар 200; в llms.txt

- ≥2 входящих внутренних ссылки, ≥3 исходящих

- Lighthouse 100/100/100/100 mobile на странице; axe 0

- Прочитано вслух/скринридером: short answer понятен без контекста

- IndexNow пинг; LinkedIn-пост; при обновлении — «What changed»
