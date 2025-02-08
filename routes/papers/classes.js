const { alertAdmins } = require("./store");

class entity{
    constructor(o,admin){
        
        if(!o) o = {};

        this.active =       o.hasOwnProperty(`active`) ? Boolean(o.active) : true;
        this.createdAt =    new Date();
        this.createdBy =    admin ? +admin.id : null;
        this.name =         o.name ? o.name : null;
        this.description =  o.description || o.desc || null;

    }
    get js(){
        let t = JSON.parse(JSON.stringify(this));
        t.createdAt = new Date(t.createdAt);
        return t;
    }
}


class AlreadyError extends Error{
    constructor(message){
        super(message);
        this.name = `alreadyError`;
    }
}

class PermissionDenied extends Error{
    constructor(message){
        super(message);
        this.name = `permissionDenied`;
    }
}

class SearchError extends Error {
    constructor(message){
        super(message);
        this.name = `searchError`
    }
}

class OccupiedError extends Error {
    constructor(message){
        super(message);
        this.name = `occupiedError`
    }
}

class PollAnwer extends entity{
    constructor(data){
        super(data);
        this.user = data.user;
        this.q =    data.q;
        this.text = data.text || null;
    }
}

const statuses = {
    active:     `active`,
    paid:       `paid`,
    cancelled:  `cancelled`,
    nc:         `nc`,
    used:       `used`
}

class PodcastRecord extends entity{
    constructor(data,admin){
        super(data,admin)

        this.date =     data.date || null;
        this.time =     +data.time || null;
        this.user =     +data.user || null;
        this.paid =     false;
        this.status =   statuses.active
    }
}

class Page extends entity{
    constructor(data,admin){
        super(data,admin);
        this.html = data.html || null;
        this.views = 0;
        this.slug = data.slug || null;
    }
}

class Hall extends entity{
    constructor(data,admin){
        super(data,admin)
        this.floor =            +data.floor;
        this.capacity =         +data.capacity;
        this.pics =             data.pics;
        this.price =            +data.price;
        this.isCoworking =      data.isCoworking || false;
        this.isMeetingRoom =    data.isMeetingRoom || false;
    }
}

class Plan extends entity {
    constructor(data,admin){
        super(data,admin);
        this.price =    +data.price;
        this.events =   +data.events;
        this.visits =   +data.visits;
        this.days =     +data.days
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
    PollAnwer,
    Author,
    classRecord,
    entity,
    Hall,
    newPlanRecord,
    Page,
    Plan,
    PodcastRecord,
    
    PermissionDenied,
    SearchError,
    OccupiedError,
    AlreadyError,
}