const { ifBefore, devlog } = require("../common");
const { udb } = require("./cols");

let users = {};

ifBefore(udb,{}).then(ulist=>{
    devlog(`пользователи обработаны`)
    ulist.forEach(u => {
        users[u.id] = u
    });
})

module.exports.usersCache = {
    get(id){
        devlog(`запрос пользователя ${id}`)
        return users[id]
    },
    upd(user){
        devlog(`обновление пользователя ${user.id}`)
        
        if(!users[user.id]) users[user.id] = {};

        Object.keys(user).forEach(key=>{
            users[user.id][key] = user[key]
        })
    }
}