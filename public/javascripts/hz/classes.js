class page{
    constructor(d){
        this.hidden = ko.observableArray([])
        this.houses = ko.observableArray((d.houses||[]).map(h=>new house(h)))
    }
}

class house{
    constructor(h){
        this.region = ko.observable(h.region || null)
        this.id =       ko.observable(h.id || null)
        this.pallet = ko.observable(h.pallet || null)
        this.xl = ko.observable(h.xl || null)
        this.l = ko.observable(h.l || null)
        this.m = ko.observable(h.m || null)
        this.s = ko.observable(h.s || null)
        this.lb = ko.observable(h.lb || null)
        this.delivery = ko.observable(h.delivery || null)

        this.edit = (field) => {
            let nv = prompt(`Укажите новое значение`);
            if(nv) axios.put(`/${host}/api/shopHouses/${curShop}`,{
                attr: `${h.id}.${field}`,
                value: nv
            }).then(()=>{
                this[field](nv)
            }).catch(err=>{
                console.log(err)
            })
            
        }
    }
}