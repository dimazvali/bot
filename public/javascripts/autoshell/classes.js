
class autoPage {
    constructor(p) {
        
        
        this.pairs = ko.observableArray(p.pairs ? p.pairs.map((p, i) => new pair(p, i)) : [])
        
        this.addPair = (p)=>this.pairs.push(new autoPair(p))
        
        this.add = (p)=>this.pairs.push(p)
        
        this.del = (p) => {
            this.pairs.remove(p)
        }

        this.hidden = ko.observableArray([`address`])
        
        this.toggleHidden = (v)=>{
            if(this.hidden.indexOf(v)>-1){
                this.hidden.splice(this.hidden.indexOf(v),1)
            } else {
                this.hidden.push(v)
            }
            console.log(this.hidden())
        }

        this.sorted = ko.observable(null)


        this.sort = (v) => {
            let direction = false;

            if(this.sorted() == v) {
                 direction = true;
            } else {
                this.sorted(false)
                this.sorted(v)
            }
            // direction
            this.pairs.sort((a,b)=>{
                
                if(direction){
                    this.sorted(false)
                    return a[v]()<b[v]()?1:-1
                    
                } else {
                    return a[v]()<b[v]()?-1:1
                }
                
            })
        }

    }
}

class autoPair {
    constructor(p) {
        Object.keys(mask2).forEach(t=>{
            this[t] = ko.observable(mask2[t](p[t],p) ? mask2[t](p[t],p) :(p[t] || null))
        })

        

        this.update = (v)=>{
            console.log(`прилетело обнволение`)
            console.log(v);
            
            Object.keys(mask2).forEach(t=>{
                this[t](mask2[t](v[t],v) ? mask2[t](v[t],v) : (v[t] || null))
            })
        }
    }
}

let dataM = new autoPage({})


let mask2 = {
    createdAt:(v)=>drawDate(v,false,{time:true}),
    url:(v,d)=>`<a href="${v}"><img class="token" src="${d.pic}"></a>`,
    // pairAddress: p.pairAddress,
    address:(v)=>v,
    symbol:(v)=>v,
    bfb:(v)=>v,
    mintAuthority:(v)=>v,
    freezeAuthority:(v)=>v,
    totalSupply:(v)=>v,
    exist:(v)=>v,
    liquiditySupply:(v)=>v,
    liquiditySupplyPercent:(v)=>v,
    pooledSol:(v)=>v,
    initialSolPrice:(v)=>v,
    solRate:(v)=>v,
    directRate:(v)=>v,
    singleTransactionBuyRate:(v)=>v,
    buyersTransferRate:(v)=>v,
    cexTransferRate:(v)=>v,
    priceNative:(v)=>v,
    priceUsdOriginal:(v)=>v,
    priceUsd:(v)=>v,
    priceCompare:(v)=>v,
    volume_h24:(v)=>v,
    volume_h6:(v)=>v,
    volume_h1:(v)=>v,
    volume_m5:(v)=>v,
    priceChange_m5:(v)=>v,
    priceChange_h1:(v)=>v,
    priceChange_h6:(v)=>v,
    priceChange_h24:(v)=>v,
    liquidity_usd:(v)=>v,
    liquidity_base:(v)=>v,
}
