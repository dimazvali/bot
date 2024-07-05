class page{
    constructor(d){
        this.hidden = ko.observableArray([])
        this.houses = ko.observableArray((d.houses||[]).map(h=>new house(h)))
    }
}

class settingsPage{
    constructor(d){
        this.settings = ko.observableArray((d.settings||[]).map(h=>new Setting(h)))
        this.up=(e)=>{
            
            let index = this.settings.indexOf(e)
            if(index){
                this.settings.splice(this.settings.indexOf(e),1)
                this.settings.splice(index-1,0,e)
            }
            this.rescore()
        }
        this.down=(e)=>{
            let index = this.settings.indexOf(e)
            if(index < this.settings().length){
                console.log(index)
                this.settings.splice(this.settings.indexOf(e),1)
                this.settings.splice(index+1,0,e)
            }
            this.rescore()
        }
        this.rescore = () =>{
            this.settings().forEach((element,i) => {
                axios.put(`/${host}/api/shopSettings/${curShop}`,{
                    attr: `${element.id()}.sort`,
                    value: this.settings().length-i
                })
            });
        }
    }
}

class Setting{
    constructor(s){
        this.id =       ko.observable(s.id),
        this.active =   ko.observable(s.active || false)
        this.name =     ko.observable(s.name || false)
        this.price =    ko.observable(s.price || null)
        this.sort =     ko.observable(s.sort || 0)  
        
        this.toggle=()=>{
            let nv = this.active()
            console.log(nv);
            axios.put(`/${host}/api/shopSettings/${curShop}`,{
                attr: `${s.id}.active`,
                value: !nv
            }).then(()=>{
                console.log(nv);
                this.active(nv ? false : true)
                console.log(`новое значение поля: `,this.active())
            }).catch(err=>{
                console.log(err)
            })
        }
        this.edit = (field) => {
            let nv = prompt(`Укажите новое значение`);
            if(nv) axios.put(`/${host}/api/shopSettings/${curShop}`,{
                attr: `${s.id}.${field}`,
                value: nv
            }).then(()=>{
                this[field](nv)
            }).catch(err=>{
                console.log(err)
            })
        }
    }
}

class house{
    constructor(h){
        this.region =   ko.observable(h.region || null)
        this.id =       ko.observable(h.id || null)
        this.pallet =   ko.observable(h.pallet || null)
        this.xl =       ko.observable(h.xl || null)
        this.l =        ko.observable(h.l || null)
        this.m =        ko.observable(h.m || null)
        this.s =        ko.observable(h.s || null)
        this.lb =       ko.observable(h.lb || null)
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