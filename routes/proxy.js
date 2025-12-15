var express =   require('express');
var router =    express.Router();
var axios =     require('axios');

router.post(`/`,async(req,res)=>{
    let d = await axios[req.body.method](req.body.path);
    res.json(d.data);
})


module.exports = router;