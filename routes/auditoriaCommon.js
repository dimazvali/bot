function randomStyle() {
    let random = Math.floor(Math.random() * 100)
    let bl = 100 - random;
    let br = Math.floor(Math.random() * 100)
    let tr = 100 - br
    return `border-top-left-radius: ${random}%;border-bottom-left-radius: ${bl}%;border-top-right-radius: ${tr}%;border-bottom-right-radius: ${br}%;`
}

function randomPic() {
    let images = [
        '3b.png',
        'b1.png',
        'b2.png',
        'w1.png',
        'w2.png'
    ]

    return `${ngrok}/images/auditoria/${images[Math.floor(Math.random()*images.length)]}`
}


const translations = {
    planConfirmed: (plan) => {
        return {
            ru: `Поздравляем! Вы оформили подписку на абонемент ${plan.name}. Он будет действовать в течение ${plan.days} дней.`,
            en: `Congratulations! You've bought a plan for ${plan.events} events. Feel free to use it in the next ${plan.days} days.`
        }
    },
    thanks: {
        ru: `Спасибо!`,
        en: `Thank you!`
    },
    course: {
        ru: `Курс`,
        en: `Course`
    },
    allByCourse: (a) => {
        return {
            ru: `Новые события в курсе ${a}`,
            en: `New events within course ${a}`
        }
    },
    allByAuthor: (a) => {
        return {
            ru: `Новые события с участием ${a}`,
            en: `New events with ${a}`
        }
    },
    noContent: {
        ru: `Извините, здесь пока пусто...`,
        en: `Sorry, there's nothing to show yet...`
    },
    authorDetails: {
        ru: `Подробнее об авторе`,
        en: `More about the author`
    },
    addedSubscription: {
        ru: `Подписка оформлена!`,
        en: `Subscription was set`
    },
    deletedSubscription: {
        ru: `Подписка отменена`,
        en: `Subscription was cancelled`
    },
    subscribe: {
        ru: `Подписаться на обновления`,
        en: `Subscribe`
    },
    unsubscribe: {
        ru: `Отписаться от обновлений`,
        en: `Unsubscribe`
    },
    yourCode: {
        ru: 'Ваш код (вместо билета, лучше него)',
        en: `Ypur entrance code`
    },
    newLecture: (l) => {
        return {
            ru: `Отличные новости! Мы подготовили новую лекцию: «${l.name}». Ее проведет ${l.author}, ${new Date(l.date).toLocaleDateString()}.`,
            en: `Hello there! We have a new lecture coming: ${l.name} by ${l.author} on ${new Date(l.date).toLocaleDateString()}.`
        }
    },
    tellMeMore: {
        ru: 'Подробнее',
        en: 'More'
    },
    coworkingReminder: (hall) => {
        return {
            ru: `Доброе утро! Просто напоминаю, что сегодня вас ждут в коворкинге. Комната ${hall.name}, ${hall.floor} этаж.`,
            en: `Good morning! Looking forward to meet you at our coworking. Room ${hall.name}, on the ${hall.floor}.`
        }
    },
    mrReminder: (t) => {
        return {
            ru: `Напоминаем, что через пару минут (в ${t}) для вас забронирована переговорка.`,
            en: `Just to remind you, that you have booked a meeting room on ${t}.`
        }
    },
    schedule: {
        ru: 'Расписание',
        en: 'Schedule'
    },
    coworking: {
        ru: 'Коворкинг',
        en: 'Coworking'
    },
    mr: {
        ru: 'Переговорка',
        en: 'Meeting Room'
    },
    paymentTitleClass: (l) => {
        return {
            ru: `Оплата лекции ${l.name}`,
            en: `Payment for the lecture ${l.name}`
        }
    },
    nosais: {
        ru: `Извините, я не знаю такой команды. Уведомлю админа; кажется, что-то пошло не так...`,
        en: `Beg your pardon, I have no idea what to do about this task. I shall talk to my master...`
    },
    congrats: {
        en: 'Welcome aboard! You are registered as coworker.',
        ru: 'Поздравляем, вы зарегистрированы как сотрудник auditoria'
    },
    book: {
        ru: 'Записаться',
        en: 'Book a place'
    },
    noFee: {
        ru: 'Вход бесплатный ',
        en: 'Free admittance'
    },
    fee: {
        ru: 'Вход: ',
        en: 'Entry fee: '
    },
    hall: {
        ru: 'Зал',
        en: 'Hall'
    },
    author: {
        ru: 'Автор',
        en: 'Author'
    },
    minutes: {
        ru: 'минут',
        en: 'minutes'
    },
    bookHall: {
        ru: 'Забронировать зал',
        en: 'Book the space'
    },
    hallSchedule: {
        ru: 'Посмотреть график',
        en: 'Schedule'
    },
    intro: {
        ru: `Здравствуй, друг. Прощай, трезвый день.\nТы можешь посмотреть расписание лекций, забронировать место в коворкинге или переговорке — или сразу пройти в бар. Там мы тебя ждем...\n`,
        // Удобнее всего пользоваться ботом с помощью приложения: вот эта кнопочка в нижнем левом углу...
        en: `Hello there! Glad to meet you!`
    },
    introButton: {
        ru: `Открыть приложение`,
        en: `release the kraken!`
    },
    payOnSite: (v) => {
        return {
            ru: `Оплачу на месте (${common.cur(v,'GEL')}).`,
            en: `I'll pay on premise (${common.cur(v,'GEL')}).`
        }
    },
    pay: (v) => {
        return {
            ru: `Оплатить ${v}`,
            en: `Pay ${v}`
        }
    },
    lectureInvite: (l) => {
        return {
            ru: `Отлично! Ждем вас на лекции «${l.name}». 
            
            ${l.price? 
                `Напоминаем, что в день мероприятия стоимость составит ${cur(l.price2 || c.price ,`GEL`)}. Чтобы оплатить билет заранее, переведите ${cur(l.price ,`GEL`)} на ${l.paymentDesc || l.bankCreds || `счет GE28TB7303145064400005`} — и скиньте боту скриншот с подтверждением платежа.` : ''}`,
            en: `Great! Looking forward to meet you`
        }
    },
    lectureReminder: (l) => {
        return {
            ru: `Напоминаем, что сегодня в ${l.time} мы ждем вас на лекции ${l.name}.`,
            en: `Great! Looking forward to meet you`
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
        ru: 'Ваше место пусто не останется',
        en: 'You are in!'
    },
    youArBanned: {
        ru: 'Извините, вам будут не рады...',
        en: 'Sorry, we can\'t let you in...'
    },
    noSeatsLeft: {
        ru: 'Простите, но свободных мест не осталось.',
        en: 'We are sorry — no seats lefts.'
    },
    alreadyBooked: {
        ru: 'Это место уже захвачено, мон колонель!',
        en: 'You have already booked a place.'
    },
    alreadyBookedClass: {
        ru: 'Извините, но вы уже записывались на эту лекцию.',
        en: 'You have already booked a place.'
    },
    coworkingBookingDetails: (date, name, lang) => {
        return {
            ru: `Вы записались в коворкинг на ${common.drawDate(date,lang)}.`,
            en: `You booked a place at on ${common.drawDate(date,lang)}.`
        }
    },
    seats: {
        ru: `п/м`,
        en: 'seats left'
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
        ru: `В коворкинге 12 мест. Стоимость за день 20 GEL, в неделю — 90.`,
        en: `We have room for 12 people. The price is 20 GEl per day (90 per week).`
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
        ru: `Извините, но вам не рады.`,
        en: `Sorry, but you're not welcome.`
    }
}
