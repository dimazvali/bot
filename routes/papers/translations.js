const { drawDate, cur, letterize, shuffle, handleQuery } = require("../common")
const { eventTypes } = require("./cols")
const { coworkingPrice, localTime } = require("./store")

let eTypes = {}

eventTypes.get().then(col => {
    handleQuery(col).forEach(m => {
        eTypes[m.en] = m
    })
})



const translations = {
    planTerminated:(p,u)=>{
        return {
            ru: `Все хорошее когда-то заканчивается. Вот и ваша подписка ${p.name} закончилась ${drawDate(p.to._seconds*1000)}. Давайте повторим?`,
            en: `Your plan ${p.name} has expired on ${drawDate(p.to._seconds*1000,'en')}. Would you like to renew it?`
        }
    },
    deposited:(left)=>{
        return {
            ru: `Ваш депозит обновлен. Текущий остаток: ${cur(left,`GEL`)}.`,
            en: `You deposit was updated. Current balance: ${cur(left,`GEL`)}`
        }
    },
    winePoured:{
        ru:(glasses)=>`Поздравяем! Вы оформили абонемент на вино в Гамоцеме.\n${letterize(glasses,'ходка')} в вашем распоряжении.\nuse it wisely`,
        en: (glasses)=>`Сongratulations! You've got a certificate for ${glasses} glasses of wine at out bar. Use them wisely.`
    },
    tariffs:{
        en: `Tariffs`,
        ru: `Тарифы`
    },
    whatWasWrong:{
        ru: `Если не сложно, расскажите, пожалуйста, что вам не понравилось — мы постараемся учесть и исправиться.`,
        en: `Could you please tell us what we should improve?..`
    },
    // rcInvite:{
    //     ru:(f,s)=>`Ваш рандомный кофе готов!\nВстречайте [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id}). ${f.occupation == s.occupation ? `Как и вы, э`: `Э`}тот человек работает в области ${s.occupation}.\nА вот, что он пишет о себе сам: ${s.about}.\nДело за малым: договориться о месте и времени встречи. А если стесняетесь, вот вам пара тем для начала беседы: \n${rcQuestionsPapersEdition(f,s)}`,
    //     en:(f,s)=>`Your random coffee is ready!\nGreet @${s.username}. ${f.occupation == s.occupation ? `Just like you t`: `T `}his person occupation is in ${s.occupation}.\nAnd that's how he/she describes him/herself: ${s.about}.\nDon't feel shy to write and set a place and time for a cup of coffee. You are? Well, here are some topics to start a conversation:\n${rcQuestions(f,s)}`
    // },
    rcInvite:{
        // @ts-ignore
        ru:(f,s)=>`Привет!\nТвой собеседник [@${s.username||s.first_name||s.last_name}](tg://user?id=${s.id}). ${f.occupation == s.occupation ? `Как и ты, э`: `Э`}тот человек работает в области ${s.occupation}.\nА вот, что он пишет про себя: ${s.about}.\nДоговоритесь с ним о формате и времени встречи. Если вам будет тяжело начать беседу, вот пара вопросов для старта: \n${rcQuestionsPapersEdition(f,s)}`,
        en:(f,s)=>`Your random coffee is ready!\nGreet @${s.username}. ${f.occupation == s.occupation ? `Just like you t`: `T `}his person works in ${s.occupation}.\nAnd that's how he/she describes him/herself: ${s.about}.\nDon't feel shy to write and set a place and time for a cup of coffee. Well, here are some topics to start a conversation:\n${rcQuestions(f,s)}`
    },
    rcMissingDetails:{
        ru: `Чтобы все сработало, пожалуйста, заполните профиль.`,
        en: `Looks like something's missing in your profile. Please, fill it in.`
    },
    welcome2RC: {
        ru: `Добро пожаловать в рандомный кофе. Раз в неделю мы будем знакомить вас с новыми людьми в Тбилиси. Enjoy and stay safe.`,
        en: `Welcome to random. We'll send you your options next friday. Stay safe and funny.`
    },
    tooLate:{
        ru: `Извините, нельзя отменить прошлое. И прошедшее.`,
        en: `We're sorry: too late to reconsider`
    },
    staff:{
        ru: `Дорогая редакция`,
        en: `Come and work with us`
    },
    authors:{
        ru: `Постоянные резиденты Papers Kartuli.`,
        en: `Our beloved residents.`
    },
    openClass:{
        ru: `открыть событие`,
        en: `open app`
    },
    review: {
        ru: `Оставьте отзыв`,
        en: `Review`
    },
    askForReview: {
        ru: `Добавьте пару слов, нам страшно интересно.`,
        en: `Review is well appreciated.`
    },
    notYourTicket: {
        ru: `Извините, но это не ваш билет.`,
        en: `Sorry, but that's not your ticket.`
    },
    noTicket: {
        ru: `Извините, такого билета не существует.`,
        en: `Sorry, there's no such ticket.`
    },
    thanks:{
        ru: `Спасибо!`,
        en: `Thank you!`
    },
    spareTicket:(name)=>{
        return {
            ru: `Кажется, вы хотели сходить на мероприятие «${name}», но не хватило мест?\nХорошие новости: билет как раз освободился.`,
            en: `Looks like you wanted to attent ${name}, but we've run out of spare seats. Good news: a ticket had just been spared.`
        }
    },
    planConfirmed:(plan)=>{
        return {
            ru: `Поздравляем! Вы оформили подписку на план ${plan.name}. Он будет действовать в течение ${plan.days} дней.`,
            en: `Congratulations! You've bought a plan for ${plan.visits} visits and ${plan.events} lectures. Feel free to use it in the next ${plan.days} days.`
        }
    },
    feedBackRequest:(ticket,cl)=>{
        return {
            ru: `Здравствуйте! Как вам наше мероприятие (${ticket.className})? Поставьте оценку (это вполне анонимно).${cl.slides?`\nКстати, презентацию этой лекции вы можете открыть по <a href="${cl.slides}">этой ссылке</a>.`:''}`,
            en: `Hello! Please, rate the event (${ticket.className}).${cl.slides?`\nBy the way, here's a link to the <a href="${cl.slides}">presentation</a>.`:''}`
        }
    },
    notifications: {
        ru: `Получать сообщения о новых событиях`,
        en: `Subscribe to upcomning events`
    },
    unsubscribe: {
        ru: `Отписаться от новостей`,
        en: 'Unsubscribe'
    },
    unsubscribeMessage: {
        ru: `Итак, вы отписаны. Но всегда можете передумать — и подписаться на новые лекции через приложение (раздел «Профиль»).`,
        en: `You won't get any messages about upcoming events. If can turn them on again in Profile section of the built-in app.`
    },
    toKnow: {
        en: `${coworkingPrice} GEL per day. The first day is 15 GEL.`,
        ru: `Стоимость — ${coworkingPrice} лари в день, первый тестовый день — 15.`
    },
    iliani: {
        en: '1/10 Veriko Anjaparidze St, Tbilisi, Georgia',
        ru: `Тбилиси, Улица Верико Анджапаридзе, 1/10.`,
        ka: `1/10 ვერიკო ანჯაფარიძის ქუჩა, თბილისი`
    },
    address: {
        en: 'Address',
        ru: 'Адрес'
    },
    contacts: {
        ru: `Контакты`,
        en: `Contacts`
    },
    undeposit: (v, left) => {
        return {
            ru: `С вашего счета было списано ${cur(+v,'GEL')}.`,
            en: `${cur(+v,'GEL')} was withdrawn from your account.`
        }
    },
    deposit: (v, left) => {
        return {
            ru: `На ваш счет было зачислено ${cur(+v,'GEL')}.`,
            en: `${cur(+v,'GEL')} was deposited on your account`
        }
    },
    welcomeOnPremise: {
        ru: `Добро пожаловать! Ваш билет был принят.\nЕсли произошла ошибка и вы не находитесь в Papers, пожалуйста, напишите об этом.\nВопросы лектору (или организаторам) вы можете задать через приложение, на странице мероприятия.\nТам же вы сможете поставить оценку и оставить отзыв о мероприятии (они очень важны для нас).`,
        en: `Glad to see you on premise.\nIf there's been a mistake and you are not in Papers Space right now, please, write about immediately.`
    },
    roomBlocked: {
        ru: `Извините, в этот день комната закрыта на спецобслуживание.`,
        en: `We're sorry, but the room is closed on that day.`
    },
    coworkingBookingConfirmedBonus: {
        ru: `Ждем вас по адресу 1 Veriko Anjaparidze (вход под вывеской ILIANI Hotel), c 9:00 до 21:00.  Если у вас будут вопросы, пишите прямо в чат-бот, и наш администратор вам ответит.`,
        en: 'We are waiting for you at 1 Veriko Anjaparidze (entrance under the sign of ILIANI Hotel), from 9:00 to 21:00. If you have any questions, write directly to the chatbot and our administrator will answer you.',
        ka: `გელოდებით ვერიკო ანჯაფარიძის 1-ში (შესასვლელი სასტუმრო ილიანის ნიშნით), 9:00-დან 21:00 საათამდე. თუ თქვენ გაქვთ რაიმე შეკითხვები, მოგვწერეთ პირდაპირ ჩატბოტზე და ჩვენი ადმინისტრატორი გიპასუხებთ.`
    },
    coworkingInit: {
        ru: `Прежде чем записаться, пожалуйста, заполните профиль. Помимо всего, напишите 3 предложения о себе: мы будем рады узнать, с кем мы делим пространство.`,
        en: `Please complete your profile before enrolling. Above all, write 3 sentences about yourself: we'd love to know who we're sharing the space with.`,
        ka: `გთხოვთ შეავსოთ თქვენი პროფილი რეგისტრაციამდე. უპირველეს ყოვლისა, დაწერეთ 3 წინადადება თქვენს შესახებ: ჩვენ გვსურს ვიცოდეთ ვისთან ერთად ვიზიარებთ სივრცეს.`
    },
    app: {
        ru: `Приложение`,
        en: 'App',
        ka: `App`
    },
    about: {
        en: `About`,
        ru: `Пару слов о себе`
    },
    media: {
        en: `Journalism`,
        ru: `Журналистика`
    },
    lawyer: {
        en: `Law`,
        ru: `Юриспруденция`
    },
    advertisement: {
        en: `PR & Advertisement`,
        ru: `Реклама и PR`
    },
    it: {
        en: `IT`,
        ru: `IT`
    },
    other: {
        en: `Other`,
        ru: `Другое`
    },

    profileSubTitle: {
        en: `Nice to meet you, by the way.`,
        ru: `Видим вас как наяву.`
    },
    dataMissing: {
        ru: `Прежде чем записаться, пожалуйста, заполните профиль. Помимо всего, напишите 3 предложения о себе: мы будем рады узнать, с кем мы делим пространство.`,
        en: `Please complete your profile before enrolling. Above all, write 3 sentences about yourself: we'd love to know who we're sharing the space with.`,
        ka: `გთხოვთ შეავსოთ თქვენი პროფილი რეგისტრაციამდე. უპირველეს ყოვლისა, დაწერეთ 3 წინადადება თქვენს შესახებ: ჩვენ გვსურს ვიცოდეთ ვისთან ერთად ვიზიარებთ სივრცეს.`
    },
    fellow: {
        ru: `Поздравляем! Вы зарегистрированы в программе fellows!`,
        en: `Congrats! You're in the fellows team!`
    },
    coworkingBookingDetails: (date, name, lang) => {
        return {
            ru: `Вы записались в коворкинг (${translations.room[lang] || translations.room.en} ${name}) на ${drawDate(date,lang)}.`,
            en: `You booked a place at ${translations.room[lang] || translations.room.en} ${name} on ${drawDate(date,lang)}.`
        }
    },
    save: {
        ru: `Сохранить`,
        en: 'Save and close'
    },
    saved: {
        ru: `Записано!`,
        en: 'Saved'
    },
    seats: {
        ru: `мест`,
        en: 'seats'
    },
    floor: {
        ru: `Этаж`,
        en: 'Floor'
    },
    room: {
        ru: `Кабинет`,
        en: 'Room'
    },
    bookOn: (d) => {
        return {
            ru: `Забронировать на ${d}`,
            en: `Book on ${d}`
        }
    },
    unbookOn: (d) => {
        return {
            ru: `Снять бронь на ${d}`,
            en: `Cancel on ${d}`
        }
    },
    enlisted: {
        ru: `вы записаны`,
        en: `your are in`
    },
    noOccupationProvided: {
        ru: 'Прежде, чем записаться в коворкинг, вам надо указать сферу своей деятельности. Пожалуйста, перейдите в "профиль" и внесите контактные данные',
        en: 'You haven\'t set your occupation yet. Please, provide your contacts in the Profile section.'
    },
    noEmailProvided: {
        ru: 'Прежде, чем записаться в коворкинг, вам надо указать свою почту. Пожалуйста, перейдите в "профиль" и внесите контактные данные',
        en: 'You haven\'t set your email yet. Please, provide your contacts in the Profile section.'
    },
    email: {
        ru: 'email',
        en: 'email'
    },
    name: {
        ru: 'Имя',
        en: 'First name',
        ka: 'სახელი'
    },
    sname: {
        ru: 'Фамилия',
        en: 'Family name',
        ka: 'გვარი'
    },
    occupation: {
        ru: 'укажите род деятельности',
        en: 'what\'s you occupation',
        ka: 'საქმიანობის სფერო'
    },
    loading: {
        ru: 'Загружаем данные',
        en: 'Loading data',
        ka: 'ვტვირთავთ ინფორმაციას'
    },
    profile: {
        ru: 'Профиль',
        en: 'Profile',
        ka: 'პროფილი'
    },
    coworkingRules: {
        ru: 'Смотреть правила',
        en: 'See rules',
        ka: 'იხილეთ წესები'
    },
    classClosed: (c) => {
        return {
            en: `We are sorry to inform you, that ${c.type ? eTypes[c.type].en : ''} ${c.name} was cancelled. Stay tuned, we're gonna come up with even better events.`,
            ru: `К сожалению, ${c.type ? eTypes[c.type].ru : ''} «${c.name}» отменяется.\nНадеемся увидеть вас на других мероприятиях. Остаемся на связи.`,
            ka: `ბოდიშს გიხდით გაცნობებთ, რომ ${c.type ? eTypes[c.type].ka : ''} ${c.name} გაუქმდა. თვალყური ადევნეთ, ჩვენ კიდევ უფრო კარგ მოვლენებს მოვაწყობთ`
        }
    },
    yourCode: {
        ru: 'Ваш код (вместо билета, лучше него)',
        en: `Your entrance code`,
        ka: 'თქვენი ბილეთის კოდი'
    },
    newLecture: (l) => {
        return {
            ru: `Отличные новости! Мы подготовили ${eTypes[l.type].nom}: «${l.name}».${l.author ? ` Ее проведет ${l.author}` : ''}, ${new Date(l.date).toLocaleDateString()}.\nНачало в ${new Date(l.date).toLocaleTimeString(
                'ru-RU',{
                    timeZone: 'Asia/Tbilisi'
                }
            )}${l.price?`\nСтоимость: ${cur(l.price,'GEL')}`:''}`,
            en: `Hello there! We have a new ${eTypes[l.type].en} coming: ${l.name} by ${l.author} on ${new Date(l.date).toLocaleDateString()}.`,
            ka: `გაუმარჯოს! ჩვენ გვაქვს ახალი ${eTypes[l.type].ka} მომავალი: ${l.name} ${l.author}-ის მიერ ${new Date(l.date).toLocaleDateString()}`
        }
    },
    tellMeMore: {
        ru: 'Подробнее',
        en: 'More',
        ka: 'დამატებითი ინფორმაცია'
    },
    coworkingReminder: (hall) => {
        return {
            ru: `Доброе утро! Просто напоминаю, что сегодня вас ждут в коворкинге. Комната ${hall.name}, ${hall.floor} этаж.`,
            en: `Good morning! Looking forward to meet you at our coworking. Room ${hall.name}, on the ${hall.floor}.`,
            ka: `დილა მშვიდობისა! გახსენებთ, რომ დღეს თქვენ ხართ ჩაწერილი კოვორკინგში. ოთახი ${hall.name}, ${hall.floor} სართული`
        }
    },
    mrReminder: (t) => {
        return {
            ru: `Напоминаем, что через пару минут (в ${t}) для вас забронирована переговорка.`,
            en: `Just to remind you, that you have booked a meeting room on ${t}.`,
            ka: `შეგახსენებთ, რომ 2 წუთში ${t}-ზე თქვენ გაქვთ ჩაწერა საკონფერენციო ოთახში`
        }
    },
    schedule: {
        ru: 'Афиша мероприятий',
        en: 'Events',
        ka: 'განრიგი'
    },
    coworking: {
        ru: 'Записаться в коворкинг',
        en: 'Coworking',
        ka: 'კოვორკინგი'
    },
    mr: {
        ru: 'Переговорка',
        en: 'Meeting Room',
        ka: 'საკონფერენციო ოთახი'
    },
    paymentTitleClass: (l) => {
        return {
            ru: `Оплата лекции ${l.name}`,
            en: `Payment for the lecture ${l.name}`,
            ka: `ლექციის გადახდა ${l.name}`
        }
    },
    nosais: {
        ru: `Извините, я не знаю такой команды. Уведомлю админа; кажется, что-то пошло не так...`,
        en: `Beg your pardon, I have no idea what to do about this task. I shall talk to my master...`,
        ka: 'გიხდით ბოდიშს, ასეთ ბრძანებას ვერ ვიგებ. ადმინისტრატორზე გადაგრთავთ.'
    },
    congrats: {
        en: 'Welcome aboard! You are registered as coworker.',
        ru: 'Поздравляем, вы зарегистрированы как сотрудник papers',
        ka: 'გილოცავთ, თქვენ დარეგისტრირდით როგორც Papers-ის თანამშრომელი'
    },
    book: {
        ru: 'Записаться',
        en: 'Book a place',
        ka: 'ჩაწერვა'
    },
    // noFee: {
    //     ru: 'Вход бесплатный ',
    //     en: 'Free admittance',
    //     ka: 'უფასო შესვლა'
    // },
    noFee: {
        ru: '',
        en: '',
        ka: ''
    },
    fee: {
        ru: 'Стоимость ',
        en: 'Entry fee ',
        ka: 'შესვლა'
    },
    hall: {
        ru: 'Зал',
        en: 'Hall'
    },
    author: {
        ru: 'Спикер',
        en: 'Speaker',
        ka: 'ავტორი'
    },
    minutes: {
        ru: 'минут',
        en: 'minutes',
        ka: 'წუთი'
    },
    bookHall: {
        ru: 'Забронировать зал',
        en: 'Book the space',
        ka: 'ოთახია დაჯავშნა'
    },
    hallSchedule: {
        ru: 'Посмотреть график',
        en: 'Schedule',
        ka: 'განრიგის ნახვა'
    },
    intro: {
        ru: `Добро пожаловать в пространство PAPERS от Paper Kartuli. Тут можно:  

— забронировать место в коворкинге или переговорке;
— посмотреть расписание лекций; 
— арендовать бар или подкастерскую. 

Удобнее всего пользоваться ботом с помощью приложения: вот эта кнопочка внизу (или в нижнем левом углу). 

Пробный день в коворкинге — 15 GEL. Следующие дни — по стандартному тарифу 30 GEL в день, оплата на месте). Для аренды бара или подкастерcкой напишите прямо в наш чат-бот, и наш администратор вам ответит.`,
        en: `Welcome to the Papers space by Paper Kartuli. Here you can:

— Book a place in the coworking space or meeting room; 
— Check the lecture schedule; 
— Rent a bar or podcast studio.

The most convenient way to use the bot is through the app: press the button at the bottom (or in the lower left corner).

A trial day in the coworking space costs 15 GEL. Subsequent days are at the standard rate of 30 GEL per day, with payment on site. To rent the bar or podcast studio, write directly to the bot, and our administrator will respond to you.
`,
        ka: `კეთილი იყოს თქვენი მობრძანება PAPERS-ში. აქ შეძლებთ:

— ადგილის დაჯავშნას ქოვორქინგსა და სათათბიროში; 
— ლექციების განრიგის ნახვას;
— ბარისა და პოდკასტ-სტუდიის ქირაობას.

ყველაზე მოსახერხებელი აპლიკაციის ბოტით სარგებლობაა: აი, ეს ღილაკი ქვემოთ (ან ქვედა მარცხენა კუთხეში). 

ქოვორქინგში საცდელი დღის გატარაების ღირებულება 15 ლარია. მომდევნო დღეებში სტანდარტული ტარიფი იმოქმედებს: 30 ლარი დღეში, ადგილზე ანგარიშსწორებით. ბარისა და პოდკასტ-სტუდიის ქირაობის თაობაზე მოგვწერეთ ჩათ-ბოტში და ჩვენი ადმინისტრატორი გიპასუხებთ. 
`
    },
    introButton: {
        ru: `Открыть приложение`,
        en: `release the kraken!`,
        ka: 'აპლიკაციის გახსნა'
    },
    payOnSite: {
        ru: `Оплачу на месте.`,
        en: `I'll pay on premise.`,
        ka: 'ადგილზე გადავიხდი'
    },
    pay: (v) => {
        return {
            ru: `Оплатить ${v}`,
            en: `Pay ${v}`,
            ka: `გადახდა ${v}`
        }
    },
    lectureInvite: (l) => {
        return {
            ru: `Отлично! Ждем вас на лекции «${l.name}» (${drawDate(l.date,false,{time:true})}).${l.price?`\n\nОбратите внимание: к оплате на месте ${cur(l.price,'GEL')}`:''}`,
            en: `Great! Looking forward to meeting you. ${l.price?`\n\nBeware: entrance fee is ${cur(l.price,'GEL')}`:''}`,
            ka: `დიდი! გელოდებით ლექციაზე "${l.name}"`
        }
    },
    lectureReminder: (l,u) => {
        return {
            ru: `Напоминаем, что сегодня в ${localTime(false,new Date(l.date._seconds*1000))} мы ждем вас на лекции ${l.name}.${(l.price&&!l.payed)?`\n\nОбратите внимание: к оплате на месте ${cur(l.price,'GEL')}`:''}\n\n${(u.classesVisits||u.coworkingVisits) ? `` : `Адрес: Верико Анджапаридзе, 1 (Отель «Илиани»).`}`,
            en: `Let me remind you of upcoming event today: ${l.name} at ${localTime(false,new Date(l.date._seconds*1000))}. ${l.price?`\n\nBeware: entrance fee is ${cur(l.price,'GEL')}`:''}\n\n${(u.classesVisits||u.coworkingVisits) ? `` : `Address: 1/10, 1 Veriko Anjaparidze St, Tbilisi.`}`,
            ka: `შეგახსენებთ, რომ დღეს ${localTime(false,new Date(l.date._seconds*1000))}-ზე გელოდებით ლექციაზე ${l.name}`
        }
    },
    lectureConfirm: {
        ru: `Отлично! Ждем вас на лекции. Подробнее в сообщениях.`,
        en: `Great! Looking forward to meet you. You'll get a message with all necessary details.`
    },
    alreadyCancelled: {
        ru: 'Эта запись уже отменена',
        en: 'This record had already been cancelled'
    },
    hallNotAvailable: {
        ru: 'Извиние, это помещение более недоступно',
        en: `Sorry, this space is no available any more.`
    },
    letsTryAgain: {
        en: `One more time?`,
        ru: 'Попробуем еще разок?'
    },
    error: {
        en: 'We\'re sorry. An unexpected error occured. Sheep happened',
        ru: `Непредвиденная ошибка. Мы уже уведомили админа.`
    },
    bookingCancelled: {
        en: 'Your booking was cancelled',
        ru: `Запись отменена`
    },
    timeSelected: (d) => {
        return {
            ru: 'Время: ' + d,
            en: `Time: ${d}`
        }
    },
    dateSelected: (d) => {
        return {
            ru: 'Выбранная дата: ' + d,
            en: `Date chosen: ${d}`
        }
    },
    onIt: {
        ru: 'Секундочку',
        en: 'Just a sec...'
    },
    coworkingBookingCancel: {
        ru: 'Отменить бронь',
        en: 'Cancel booking'
    },
    coworkingBookingConfirmed: {
        ru: 'Это время забронировано за вами',
        en: 'You are in!'
    },
    youArBanned: {
        ru: 'Извините, вам будут не рады...',
        en: 'Sorry, we can\'t let you in...'
    },
    noSeatsLeft: {
        ru: 'Простите, но свободных мест не осталось. Мы напишем, если они появятся.',
        en: `We are sorry — no seats lefts. We'll let you know if a spare ticket shows up.`
    },
    alreadyBooked: {
        ru: 'Это место уже захвачено, мон колонель!',
        en: 'You have already booked a place.'
    },
    alreadyBookedClass: {
        ru: 'Извините, но вы уже записывались на эту лекцию.',
        en: 'You have already booked a place.'
    },
    chooseDate: {
        ru: `Выберите день`,
        en: `Choose a date`
    },
    chooseTime: {
        ru: `Выберите время`,
        en: `Choose time`
    },
    coworkingStart: {
        ru: `Выберите зал, в котором хотели бы работать.`,
        en: `Choose a space to work in.`
    },
    noSchedule: {
        ru: 'Извините, пока что тут пусто. Мы пришлем весточку, когда добавим что-то новое.',
        en: `Ooops! Nothing to show yet. Stay tuned.`
    },
    noClasses: {
        ru: 'Извините, дорогой друг. Вы еще не записывались. Или мы что-то забыли...\nНажмите /classes — мы покажем расписание на ближайшие дни',
        en: `Ooops! Nothing to show yet. Press /classes to see upcoming events.`
    },
    noAppointment: {
        ru: `Извините, такой записи в природе не существует`,
        en: 'Sorry, we have no idea of the appointment. Where did you get it?..'
    },
    unAuthorized: {
        ru: 'Терпеть не можем это говорить, но... у вас нет права на совершение этой операции.',
        en: `Sorry, you are not authorized to perform the action.`
    },
    appointmentCancelled: {
        ru: 'Культура отмены — тоже культура. Ваша запись снята',
        en: 'Cancel culture marching. You\'re free to go'
    },
    alreadyPayed: {
        ru: 'Вай мэ, дорогой товарищ, ваш билет уже оплачен.',
        en: 'That\'s sweet, but you have already payed for the ticket'
    },
    paymentDesc: {
        ru: `После покупки билета вы получите код — просто покажите его при входе.`,
        en: `Once the payment is through you get a code. Just show it at the reception.`
    },
    userBlocked: {
        ru: `Извините, ваш аккаунт был заблокирован.`,
        en: `Sorry, but your account was blocked.`
    }
}


function rcQuestions(f,s){
    let q = {
        media: {
            ru: [
                `Господь, угораздило вас с умом и талантом родиться в России.`,
                `Говорят, в журналистику берут всех, кроме выпускников журфаков. Правду говорят?..`,
                `О чем была ваша первая публикация? А где?..`,
                `Как вы узнали о «Бумаге»?`
            ],
            en: [
                
            ]
        },
        lawyer: {
            ru: [
                // `А что, вы тоже работали с ФБК?..`,
                `Вы занимаетесь международным правом — или консультируете на удаленке?`,
                `А вы знаете приличного бухгалтера в Тбилиси? Очень нужно.`
            ],
            en: [
                
            ]
        },
        advertisement: {
            ru: [
                `А правду говорят, что золотой век российской рекламы закончился на Бекмамбетове?`,
                `Говорят, каждый журналист в душе романист, а пиарщик — политтехнолог. Really?`,
                `Какой у вас был самый стыдный проект?`
            ],
            en: [
                
            ]
        },
        it: {
            ru: [
                `Консоль — это PlayStation. И что, у каждого браузера такая есть?..`,
                `Почему один плюс один может быть два, а может — одинадцать. `,
                `Как часто вас просят починить принтер?..`,
                `Парадокс Монти Холла — это же про Пайтон?..`
            ],
            en: [
                
            ]
        },
        other: {
            ru: [
                `Сколько видов харчо вы успели попробовать?`,
                `Знаете ли вы, что такое скуф?..`,
                `Сколько хинкали вы можете съесть за раз?`,
                `Чем бы вы занимались, если бы не нужно было зарабатывать?`
            ],
            en: [
                
            ]
        }
    } 
    return shuffle(q[s.occupation] ? q[s.occupation].ru : q.other.ru).slice(0,3).join('\n')
}

function rcQuestionsPapersEdition(){
    let types = [
        [
            'Чем ты занимаешься? ',
            'Как получилось, что ты занимаешься именно этим? ',
            'Расскажи про рабочий фейл? ',
            'А про рабочий успех? ',
            'Что бы ты делала(а), если бы не надо было зарабатывать деньги? ',
        ],[
            'Расскажи про самое запоминающееся путешествие?',
            'Как тебе нравится проводить выходные?',
            'А может, есть смешная или странная история свидания?',
            'В каком городе ты хотел(а) бы жить, если бы можно было выбрать любой?',
        ],[
            'Как давно ты в Тбилиси/другом городе?',
            'Хочешь тут остаться?',
            'Какие места в городе твои любимые?',
            'А какие места не нравятся?',
            'Чего тебе не хватает в городе, где ты живешь?',
        ]
    ]

    return shuffle(types)[0].map(q=>`— ${q}`).join(`\n`)
}




module.exports = translations;