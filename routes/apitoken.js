var axios = require('axios');
var cron = require('node-cron');
let token = null;



cron.schedule('0 0,6,12,18 * * *', () => {
    axios.post('https://iam.restorating.ru/auth/realms/prod/protocol/openid-connect/token', `grant_type=client_credentials&client_id=client-forms&client_secret=${process.env.clientSecret}`, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }
    }).then(r => {
        token = r.data.access_token
        console.log('установили токен по расписанию')
    }).catch(err=>{
        console.log(err)
    })
});


function getToken(place) {
    if (token) {
        return Promise.resolve(token).then(t => {
            if (!place) return t
            return axios.get(`https://api-places.restorating.ru/v1.0/places/${place}`, {
                headers: {
                    'Authorization': `Bearer ${t}`
                }
            }).then(p => {
                return p.data
            }).catch(err => {
                console.log(err)
                return false;
            })
        })
    } else {
        return axios.post('https://iam.restorating.ru/auth/realms/prod/protocol/openid-connect/token', `grant_type=client_credentials&client_id=client-forms&client_secret=${process.env.clientSecret}`, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        }).then(r => {
            token = r.data.access_token
            
            if (!place) return r.data.access_token

            return axios.get(`https://api-places.restorating.ru/v1.0/places/${place}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(p=>{
                return p.data
            }).catch(err=>{
                console.log(err)
                return false;
            })
        })
    }
}





module.exports = getToken;

