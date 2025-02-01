class entity{
    constructor(o,admin){
        
        if(!o) o = {};

        this.active =       o.hasOwnProperty(`active`) ? Boolean(o.active) : true;
        this.createdAt =    new Date();
        this.createdBy =    admin ? +admin.id : null;
        this.name =         o.name ? o.name : null;
    }
    get js(){
        return JSON.parse(JSON.stringify(this))
    }
}


class newPlanRecord extends entity {
    constructor(plan, admin, user){
        super(plan,admin);
        this.user =         +user.id;
        this.to =           new Date(+new Date()+plan.days*24*60*60*1000);
        this.visitsLeft =   plan.visits;
        this.eventsLeft =   plan.events;
        this.plan =         plan.id
    }
}

class Author extends entity{
    constructor(author,admin){
        super(author,admin)
        this.description = author.description||null;
        this.pic = author.pic || null;
    }
}

class classRecord extends entity{
    constructor(cl,admin){
        super(cl,admin);
        this.description =     cl.description || `Без описания`;
        this.date =            cl.date || new Date().toISOString();
        this.duration =        cl.duration || 60;
        
        this.hall =            cl.hall || `BrXsFWF4tE7K36SHQIS6`;
        
        this.capacity =        +cl.capacity || 30;
        
        this.authorName =      cl.authorName || null;
        this.author =          cl.author || null;
        
        this.admins =          cl.admins || null;
        this.fellows =         cl.fellows || null;
        this.noRegistration =  cl.noRegistration || null;
        this.price =           +cl.price || null;
        this.pic =             cl.pic || null;
        this.clearPic =        cl.clearPic || null
    }
}

module.exports = {
    classRecord,
    Author,
    entity,
    newPlanRecord,
}