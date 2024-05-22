// https://pkk.rosreestr.ru/arcgis/rest/services/PKK6/CadastreObjects/MapServer/24?f=pjson
// https://docs.google.com/document/d/1g6u8Nmf33p9gepFNMaR7PbXG6168BlO6/edit
// https://bazanpa.ru/rosreestr-prikaz-np389-ot12102011-h2078021/
let host = `reestr`
let downLoadedUsers = {};
let botLink = `https://t.me/dimazvalibot`

function closeLeft() {
    document.querySelector(`#left`).classList.remove('active')
    document.querySelectorAll(`.popupWeb`).forEach(p => p.remove())
}

function showRequests(){
    showScreen(`Документы`,`requests`,showRequestLine)
}

function showRequestLine(r){
    let c = listContainer(r, true)
    c.classList.remove(`hidden`)
    c.append(ce(`h3`,false,false,`${r.data.cn}: ${r.data.address}`,{
        onclick:()=>showRequest(r.id)
    }))
    return c
}

function showRequest(id){
    let p = preparePopupWeb(`request_${id}`)
    load(`requests`,id).then(d=>{
        let body = ce(`div`)
        p.append(body)
        showRequestData(d.data,body,d.doc)
    })
}

function showRequestData(data, body, docLink, inp, coords){
    body.innerHTML = null;
    body.append(ce(`h1`,false,false,`Общие сведения в отношении земельного участка с кадастровым номером ${inp ? inp.value : data.cn }`));

    let table = ce(`table`)
    
    Object.keys(data).filter(k=>reestr2Miss.indexOf(k)==-1).forEach(k=>{
        if(data[k]) {
            let line = ce(`tr`)
                line.append(ce(`td`,false,false,`<b>${(reestrParser[k] && reestrParser[k].f) ? reestrParser[k].name : (reestrParser[k] || k)}:</b>`))
                line.append(ce(`td`,false,false,`${(reestrParser[k] && reestrParser[k].f) ? parseUnit(k, data[k], data) : data[k]}.`))
            table.append(line)
        }
    })


    
    if(coords) body.append(ce(`img`,false,`map`,false,{
        src: `https://pkk.rosreestr.ru/arcgis/rest/services/PKK6/CadastreOriginal/MapServer/export?dpi=96&f=image&format=png8&size=1024,768&bboxSR=102100&imageSR=102100&transparent=true&bbox=${coords.xmin},${coords.ymin},${coords.xmax},${coords.ymax}&layerDefs=%7B%220%22:%22ID%20IN%20(%27${data.id}%27)%22,%222%22:%22ID%20IN%20(%27%27)%22%7D&layers=show:0,2`
    }))

    body.append(table) 

                       

    body.append(ce(`button`,false,false,`Печать`,{
        onclick:()=>{
            toPrint(body,table)
        }
    }))

    if(!docLink){
        body.append(ce(`button`,false,false,`Создать документ`,{
            onclick:()=>{
                axios.post(`/${host}/admin/requests`,data)
                .then(()=>{
                    alert(`Спасибо! Ваш запрос принят.\nСсылку на документ вы получите в боте.`)
                })
                .catch(handleError)
            }
        }))
    } else {
        body.append(ce(`a`,false,false,`открыть документ`,{
            href:   docLink,
            target: `_blank`
        }))
    }
}

function showReestr(){
    let p = preparePopupWeb(`reestr`)
    p.append(ce(`h1`,false,false,`Выписка из реестра`))
    
    let inp = ce(`input`,false,false,false,{
        type: `text`,
        placeholder: `что-то вроде 50:34:0040239:127`
    })


    let body = ce('div')

    let sb = ce(`button`,false,false,`Проверить`,{
        onclick:()=>{
            if(!inp.value) return alert(`я не вижу ваших букв!`)
            sb.setAttribute(`disabled`,true)
            body.append(ce(`h3`,false,false,`загружаем`))
            let id = inp.value.split(':');

            axios
                .get(`https://pkk.rosreestr.ru/api/features/1/${id.map(p=>+p).join(':')}`)
                .then(data=>{
                    showRequestData(data.data.feature.attrs, body, false, false, data.data.feature.extent)
                })
                .catch(handleError)
                .finally(()=>sb.removeAttribute(`disabled`))
        }
    })

    p.append(inp)
    p.append(sb)
    p.append(body)
}


function toPrint(el,table) {
	// var el=document.getElementById("table");
	table.setAttribute('border', '1px');
	table.setAttribute('cellpadding', '10');
	table.setAttribute('class', 'table table-bordered');
	table.style.borderCollapse='collapse';
 
	newPrint=window.open("");
	newPrint.document.write(el.outerHTML);
	newPrint.print();
	newPrint.close();
}

let reestrAreaTypes={
    '3001000000':'Земли сельскохозяйственного назначения',
    '3002000000':'Земли населенных пунктов',
    '3003000000':'Земли промышленности, энергетики, транспорта, связи, радиовещания, телевидения, информатики, земли для обеспечения космической деятельности, земли обороны, безопасности и земли иного специального назначения',
    '3004000000':'Земли особо охраняемых территорий и объектов',
    '3005000000':'Земли лесного фонда',
    '3006000000':'Земли водного фонда',
    '3007000000':'Земли запаса',
    '3008000000':'Категория не установлена',
}

let reestr2Miss = [
    `cad_unit`,
    `area_type`,
    `area_unit`,
]
let reestrUnits = {
    "3":"мм",
    "4":"см",
    "5":"дм",
    "6":"м",
    "8":"км",
    "9":"Мм",
    "47":"морск. м.",
    "50":"кв. мм",
    "51":"кв. см",
    "53":"кв. дм",
    "55":"кв. м",
    "58":"тыс. кв. м",
    "59":"га",
    "61":"кв. км",
    "109":"а",
    "359":"сут.",
    "360":"нед.",
    "361":"дек.",
    "362":"мес.",
    "364":"кварт.",
    "365":"полугод.",
    "366":"г.",
    "383":"руб.",
    "384":"тыс. руб.",
    "385":"млн. руб.",
    "386":"млрд. руб.",
    "1000":"неопр.",
    "1001":"отсутств.",
    "1002":"руб. за кв. м",
    "1003":"руб. за а",
    "1004":"руб. за га",
    "1005":"иные"
}

function parseUnit(key, value, data){
    if(key == `cad_cost`)   return reestrParser.cad_cost.f(value,data.cad_unit);
    if(key == `area_value`)  return reestrParser.area_value.f(value,data.area_type,data.area_unit);
    if(key == `category_type`)  return reestrParser.category_type.f(+value);
    if(key == `fp`)  return reestrParser.fp.f(+value);
    if(key == `statecd`)  return reestrParser.statecd.f(value);
    
    
    return data
}

let area_types = {
    "001" : "Площадь застройки",
    "002" : "Общая площадь",
    "003" : "Общая площадь без лоджии",
    "004" : "Общая площадь с лоджией",
    "005" : "Жилая площадь",
    "007" : "Основная площадь",
    "008" : "Декларированная площадь",
    "009" : "Уточненная площадь",
    "010" : "Фактическая площадь",
    "011" : "Вспомогательная площадь",
    "012" : "Площадь помещений общего пользования без лоджии",
    "013" : "Площадь помещений общего пользования с лоджией",
    "014" : "Прочие технические помещения без лоджии",
    "015" : "Прочие технические помещения с лоджией",
    "020" : "Застроенная площадь",
    "021" : "Незастроенная площадь",
    "022" : "Значение площади отсутствует" 
}

let ownerShipTypes = {
    100: `Частная собственность`,
    200: `Собственность публично-правовых образований`
}

let reestrStates = {
    "01": "Ранее учтенный",
    "03": "Условный",
    "04": "Внесенный",
    "05": "Временный (Удостоверен)",
    "06": "Зарегистрирован (Учтенный)",
    "07": "Снят с учета",
    "08": "Аннулированный",
    "00": "Неопределено"
}

let reestrParser = {
    statecd:{
        name: `Статус`,
        f:(v)=>reestrStates[v]||v
    },
    cad_cost:{
        name: `стоимость`,
        f:(v,cad_unit)=> `${v} ${reestrUnits[+cad_unit]}`
    },
    area_value: {
        name: `Декларированная площадь `,
        f:(v,type,unit)=> `${v}  ${reestrUnits[+unit.toString()]} (${area_types[type]})`    
    },
    category_type:{
        name: `Категория земель`,
        f:(v)=>reestrAreaTypes[v] || v
    },
    actual_date:"Дата обновления атрибутов",
    adate:"Дата обновления границ",
    address:"Адрес",
    area_dev:"Площадь застройки",
    cad_eng_data:"Кадастровый инженер",
    date_cost:"Дата внесения кадастровой стоимости",
    date_create:"Дата постановки на учет",
    depth:"Глубина",
    depth_bed:"Глубина залегания",
    fp:{
        name: "Форма собственности",
        f:(v)=> ownerShipTypes[v]||v
    },
    util_by_doc: `Разрешенное использование`,
    height:"Высота",
    cn: `Кадастровый номер`,
    kladr:"КЛАДР",
    kvartal:"Квартал",
    okrug:"Округ",
    oks_cadastral_parent:"ЗУ",
    oks_elements_construct:"Материал стен",
    oks_floors:"Общая этажность",
    oks_u_floors:"Подземная этажность",
    parcel_cn:"Условный номер",
    parcel_status:"Статус",
    proj_app:"Проектируемое назначение",
    purpose:"Назначение",
    rayon:"Район",
    right_reg:"Зарегистрированы права (да/нет)",
    room_type:"Вид жилого помещения",
    spread:"Протяженность",
    volume:"Объем",
}