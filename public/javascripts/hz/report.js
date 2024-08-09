let chartmode = false;

function switch2Charts() {
    if (chartmode) {
        Object.keys(initdata).forEach(id => {
            let c = document.querySelector(`#chart${id}`)
            c.classList.add(`hidden`);
            c.innerHTML = null;
            document.querySelector(`#table${id}`).classList.remove(`hidden`)
        })
    } else {
        Object.keys(initdata).forEach(id => {
            document.querySelector(`#chart${id}`).classList.remove(`hidden`)
            let c = document.querySelector(`#table${id}`)
            c.classList.add(`hidden`);
            showChart(id, `chart${id}`)
        })

    }
    chartmode = !chartmode;
}

function showChart(key, container) {
    let needed = initdata[key].data

    let log = {};

    needed.forEach(sell => {
        if (!log[sell.created_at.split('T')[0]]) log[sell.created_at.split('T')[0]] = 0
        log[sell.created_at.split('T')[0]]++
    });

    console.log(log);

    var data0 = [];
    var data1 = [];


    if (!container) {
        document.body.append(ce(`div`, `chartdiv`))
        document.body.append(ce(`span`, false, `closeChartdiv`, `Закрыть`, {
            onclick: () => {
                document.querySelector(`#chartdiv`).remove();
                document.querySelector(`.closeChartdiv`).remove();
            }
        }))
    }


    // let cd = new Date().toISOString().split('T')[0];

    let firstShift = 0;
    while (firstShift < 14) {
        let cd = new Date(+new Date() - firstShift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        console.log(cd, +new Date(cd));

        data0.push({
            date: new Date(cd).getTime(),
            price: +log[cd] || 0
        })
        firstShift++
    }

    let secondShift = 14;
    while (secondShift < 28) {
        let cd = new Date(+new Date() - secondShift * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        console.log(cd, +new Date(cd));

        data1.push({
            date: new Date(cd).getTime(),
            price: +log[cd] || 0
        })
        secondShift++
    }

    console.log(data0)

    // Create root element
    // https://www.amcharts.com/docs/v5/getting-started/#Root_element


    // Create root element
    // https://www.amcharts.com/docs/v5/getting-started/#Root_element
    let root = am5.Root.new(container || `chartdiv`);

    // Set themes
    // https://www.amcharts.com/docs/v5/concepts/themes/
    root.setThemes([
        am5themes_Animated.new(root)
    ]);

    // Create chart
    // https://www.amcharts.com/docs/v5/charts/xy-chart/
    var chart = root.container.children.push(
        am5xy.XYChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "panX",
            wheelY: "zoomX"
        })
    );

    // Add cursor
    // https://www.amcharts.com/docs/v5/charts/xy-chart/cursor/
    var cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
        behavior: "zoomX"
    }));
    cursor.lineY.set("visible", false);

    // Create axes
    // https://www.amcharts.com/docs/v5/charts/xy-chart/axes/
    var xAxis0 = chart.xAxes.push(
        am5xy.DateAxis.new(root, {
            baseInterval: {
                timeUnit: "day",
                count: 1
            },
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {}),
            tooltipDateFormat: "yyyy-MM-dd"
        })
    );

    var xAxis1 = chart.xAxes.push(
        am5xy.DateAxis.new(root, {
            marginTop: 10,
            baseInterval: {
                timeUnit: "day",
                count: 1
            },
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {}),
            tooltipDateFormat: "yyyy-MM-dd"
        })
    );

    var yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {})
        })
    );

    chart.get("colors").set("colors", [
        am5.color(0x095256),
        am5.color(0x087f8c),
        am5.color(0x5aaa95),
        am5.color(0x86a873),
        am5.color(0xbb9f06)
      ]);

      
    // Add series
    // https://www.amcharts.com/docs/v5/charts/xy-chart/series/
    var series0 = chart.series.push(
        am5xy.LineSeries.new(root, {
            name: "текущие результаты",
            xAxis: xAxis0,
            yAxis: yAxis,
            valueYField: "price",
            valueXField: "date",
            fill: am5.color(0x0000ff),
            stroke: am5.color(0x0000ff),
            tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
            })
        })
    );

    var series1 = chart.series.push(
        am5xy.LineSeries.new(root, {
            name: "предыдущие результаты",
            xAxis: xAxis1,
            yAxis: yAxis,
            valueYField: "price",
            valueXField: "date",
            fill: am5.color(0xcc0000),
            stroke: am5.color(0xcc0000),
            tooltip: am5.Tooltip.new(root, {
                labelText: "{valueY}"
            })
        })
    );

    // Add scrollbar
    // https://www.amcharts.com/docs/v5/charts/xy-chart/scrollbars/
    var scrollbar = chart.set("scrollbarX", am5xy.XYChartScrollbar.new(root, {
        orientation: "horizontal",
        height: 60
    }));

    var sbDateAxis = scrollbar.chart.xAxes.push(
        am5xy.DateAxis.new(root, {
            baseInterval: {
                timeUnit: "day",
                count: 1
            },
            renderer: am5xy.AxisRendererX.new(root, {})
        })
    );

    var sbValueAxis = scrollbar.chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {})
        })
    );

    var sbSeries = scrollbar.chart.series.push(
        am5xy.LineSeries.new(root, {
            valueYField: "price0",
            valueXField: "date0",
            xAxis: sbDateAxis,
            yAxis: sbValueAxis
        })
    );

    series0.data.setAll(data0);
    series1.data.setAll(data1);
    sbSeries.data.setAll(data0);

    let legend = chart.children.push(am5.Legend.new(root, {}));
    legend.data.setAll(chart.series.values);


    // Make stuff animate on load
    // https://www.amcharts.com/docs/v5/concepts/animations/
    series0.appear(1000);
    series1.appear(1000);
    chart.appear(1000, 100);
        

}