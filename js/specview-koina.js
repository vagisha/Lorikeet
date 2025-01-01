// $LastChangedDate$
// $LastChangedBy$
// $LastChangedRevision$

(function($) {

    // plugin name - specviewKoina
    $.fn.specviewKoina = function (opts) {

        var defaults = {
                sequence: null,
                charge: null,
                peakDetect: true,
                calculatedMz: null,
                precursorMz: null,
                peaks: [],
                annotations: [],
                sparsePeaks: null,
                width: 700, 	// width of the ms/ms plot
                height: 450, 	// height of the ms/ms plot
                showIonTable: true,
                showViewingOptions: true,
                showOptionsTable: true,
                peakLabelOpt: 'mz',
                showSequenceInfo: true,
                enableTooltip: true,
	            tooltipZIndex: null,
                minDisplayMz: null,
                maxDisplayMz: null
        };

	var options = $.extend(true, {}, defaults, opts); // this is a deep copy

        return this.each(function() {

            index = index + 1;
            init($(this), options);

        });
    };

    var index = 0;

    var elementIds = {
            msmsplot: "msmsplot",
            ms2plot_zoom_out: "ms2plot_zoom_out",
            zoom_x: "zoom_x",
            zoom_y: "zoom_y",
            resetZoom: "resetZoom",
            //update: "update",
            enableTooltip: "enableTooltip",
            msmstooltip: "lorikeet_msmstooltip",
            ion_choice: "ion_choice",
            deselectIonsLink: "deselectIonsLink",
            slider_width: "slider_width",
            slider_width_val: "slider_width_val",
            slider_height: "slider_height",
            slider_height_val: "slider_height_val",
            printLink: "printLink",
            lorikeet_content: "lorikeet_content",
            optionsTable: "optionsTable",
            ionTableLoc1: "ionTableLoc1",
            viewOptionsDiv: "viewOptionsDiv",
            modInfo: "modInfo",
            ionTableDiv: "ionTableDiv",
            ionTable: "ionTable",
            seqinfo: "seqinfo",
            peakDetect: "peakDetect"
    };

    function getElementId(container, elementId){
        return elementId+"_"+container.data("index");
    }

    function getElementSelector(container, elementId) {
        return "#"+getElementId(container, elementId);
    }

    function getRadioName(container, name) {
        return name+"_"+container.data("index");
    }

    function init(parent_container, options) {

        // TODO: Add support for modifications. Check which Koina models allow modifications.
        var peptide = new Peptide(options.sequence, [], [], 0, 0, 0);
        options.peptide = peptide;

        if(!options.minDisplayMz)
        {
            options.minDisplayMz = options.peaks[0][0];
        }
        if(!options.maxDisplayMz)
        {
            options.maxDisplayMz = options.peaks[options.peaks.length - 1][0];
        }

        var container = createContainer(parent_container);
        // alert(container.attr('id')+" parent "+container.parent().attr('id'));
        storeContainerData(container, options);
        initContainer(container);

        // var defaultSelectedIons = getDefaultSelectedIons(options);
        //makeOptionsTable(container,[1,2,3], defaultSelectedIons);


        makeViewingOptions(container, options);

        createPlot(container, getDatasets(container)); // Initial MS/MS Plot

        setupInteractions(container, options);

        if(options.showIonTable) {
            makeIonTable(container);
        }
    }

    function storeContainerData(container, options) {

        container.data("index", index);
        container.data("options", options);
        container.data("peakAssignmentTypeChanged", false);
        container.data("peakLabelTypeChanged", false);
        container.data("plot", null);           // MS/MS plot
        container.data("zoomRange", null);      // for zooming MS/MS plot
        container.data("previousPoint", null);  // for tooltips
        container.data("ionSeries", {a: [], b: [], c: [], x: [], y: [], z: []}); // theoretical ion series
        container.data("ionSeriesLabels", {a: [], b: [], c: [], x: [], y: [], z: []});
        container.data("ionSeriesMatch", {a: [], b: [], c: [], x: [], y: [], z: []});

        var maxInt = getMaxInt(options.peaks);
        var maxIntUp = maxInt;      //get max peaks value in up peak list
        var maxIntDown = 0;         //for 2nd "butterfly" spectrum
        if(options.peaks2){
            maxIntDown = getMaxInt(options.peaks2);   //get max peaks value in down peak list
        }

	    var __xrange = getPlotXRange(options);


        var plotOptions =  {
            series: {
                peaks: { show: true, lineWidth: 1, shadowSize: 0},
                shadowSize: 0
            },
            selection: { mode: "x", color: "#F0E68C" },
            grid: { show: true,
                    hoverable: true,
                    clickable: false,
                    autoHighlight: false,
                    borderWidth: 1,
                    labelMargin: 1},
            xaxis: { tickLength: 3, tickColor: "#000",
                     min: __xrange.xmin,
                     max: __xrange.xmax},
	    }

        var yaxis = { tickLength: 0, tickColor: "#000",
		  max: maxInt*1.1,
		  ticks: [0, maxInt*0.1, maxInt*0.2, maxInt*0.3, maxInt*0.4, maxInt*0.5,
			  maxInt*0.6, maxInt*0.7, maxInt*0.8, maxInt*0.9, maxInt],
		  tickFormatter: function(val, axis) {return Math.round((val * 100)/maxInt)+"%";}
		}

        var yaxes = [
            { tickLength: 0, tickColor: "#000",
              max: maxIntUp*1.1,
              min: maxIntUp*-1.1,
              ticks: [0, maxIntUp*0.1, maxIntUp*0.2, maxIntUp*0.3, maxIntUp*0.4, maxIntUp*0.5,
                      maxIntUp*0.6, maxIntUp*0.7, maxIntUp*0.8, maxIntUp*0.9, maxIntUp],
              tickFormatter: function(val, axis) {return Math.round((val * 100)/maxIntUp)+"%";}
            },
            { tickLength: 0, tickColor: "#000",
              min: maxIntDown*-1.1,
              max: maxIntDown*1.1,
              position:"bottom",
              ticks: [0, maxIntDown*0.1, maxIntDown*0.2, maxIntDown*0.3, maxIntDown*0.4, maxIntDown*0.5,
                      maxIntDown*0.6, maxIntDown*0.7, maxIntDown*0.8, maxIntDown*0.9, maxIntDown],
              tickFormatter: function(val, axis) {return Math.round((val * 100)/maxIntDown)+"%";},
              transform: function (v) { return -v; },
            }
        ]

        //added double yaxis for butterfly comparing:
        if (maxIntDown > 0) {
            plotOptions['yaxes'] =  yaxes;
            plotOptions.grid.markings = [{yaxis:{from:0, to:0}, color:"#555555", lineWidth:0.5}];
            plotOptions['legend'] = {position: "se"};
        }
            else {
                plotOptions['yaxis'] =  yaxis;
        }

        container.data("plotOptions", plotOptions);
        container.data("maxInt", maxInt);
    }

    // extract max from peak list
    function getMaxInt(peaks) {
        var maxInt = 0;
        for(var peak of peaks) {
            if(peak[1] > maxInt) {
            maxInt = peak[1];
            }
        }
        console.log("Max intensity:" + maxInt);
        return maxInt;
    }

    function round(number) {
	    return number.toFixed(4);
    }

    // -----------------------------------------------
    // CREATE MS/MS PLOT
    // -----------------------------------------------
    function createPlot(container, datasets) {

        var plot;
        if(!container.data("zoomRange"))
        {
            plot = $.plot($(getElementSelector(container, elementIds.msmsplot)), datasets,  container.data("plotOptions"));
        }
        else
        {
            var zoomRange = container.data("zoomRange");
            var selectOpts = {};
            if($(getElementSelector(container, elementIds.zoom_x)).is(":checked"))
            selectOpts.xaxis = { min: zoomRange.xaxis.from, max: zoomRange.xaxis.to };
            if($(getElementSelector(container, elementIds.zoom_y)).is(":checked"))
            selectOpts.yaxis = { min: 0, max: zoomRange.yaxis.to };

            plot = $.plot(getElementSelector(container, elementIds.msmsplot), datasets,
                  $.extend(true, {}, container.data("plotOptions"), selectOpts));

            // zoom out icon on plot right hand corner
            var o = plot.getPlotOffset();
            $(getElementSelector(container, elementIds.msmsplot)).append('<div id="'+getElementId(container, elementIds.ms2plot_zoom_out)+'" class="zoom_out_link" style="position:absolute; left:'
                                         + (o.left + plot.width() - 20) + 'px;top:' + (o.top+4) + 'px"></div>');

            $(getElementSelector(container, elementIds.ms2plot_zoom_out)).click( function() {
                    resetZoom(container);
            });
        }

        // we have re-calculated and re-drawn everything..
        container.data("massTypeChanged", false);
        container.data("massErrorChanged",false);
        container.data("peakAssignmentTypeChanged", false);
        container.data("peakLabelTypeChanged", false);
        container.data("selectedNeutralLossChanged", false);
        container.data("plot", plot);

    }

    function getPlotXRange(options) {

        var xmin = options.minDisplayMz;
        var xmax = options.maxDisplayMz;
        var xpadding = (xmax - xmin) * 0.025;
        // console.log("x-axis padding: "+xpadding);
        return {xmin:xmin - xpadding, xmax:xmax + xpadding};
    }

    function displayTooltip(item, container, options, tooltip_xlabel, tooltip_ylabel) {

        if ($(getElementSelector(container, elementIds.enableTooltip) + ":checked").length > 0) {
            if (item) {
                if (container.data("previousPoint") != item.datapoint) {
                    container.data("previousPoint", item.datapoint);

                    $(getElementSelector(container, elementIds.msmstooltip)).remove();
                    var x = item.datapoint[0].toFixed(2),
                    y = item.datapoint[1].toFixed(2);

                    showTooltip(container, item.pageX, item.pageY,
				tooltip_xlabel + ": " + x + "<br>" + tooltip_ylabel + ": " + y, options);
                }
            }
            else {
                $(getElementSelector(container, elementIds.msmstooltip)).remove();
                container.data("previousPoint", null);
            }
        }
    }

    // -----------------------------------------------
    // SET UP INTERACTIVE ACTIONS FOR MS/MS PLOT
    // -----------------------------------------------
    function setupInteractions (container, options) {

        // ZOOMING
        $(getElementSelector(container, elementIds.msmsplot)).bind("plotselected", function (event, ranges) {
            container.data("zoomRange", ranges);
            createPlot(container, getDatasets(container));
        });

        // ZOOM AXES
        $(getElementSelector(container, elementIds.zoom_x)).click(function() {
            resetAxisZoom(container);
        });
        $(getElementSelector(container, elementIds.zoom_y)).click(function() {
            resetAxisZoom(container);
        });

        // RESET ZOOM
        $(getElementSelector(container, elementIds.resetZoom)).click(function() {
            resetZoom(container);
        });

        // UPDATE
        $(getElementSelector(container, elementIds.update)).click(function() {
            container.data("zoomRange", null); // zoom out fully
            // setMassError(container);
            plotAccordingToChoices(container);
        });

        // TOOLTIPS
        $(getElementSelector(container, elementIds.msmsplot)).bind("plothover", function (event, pos, item) {
            displayTooltip(item, container, options, "m/z", "intensity");
        });
        $(getElementSelector(container, elementIds.enableTooltip)).click(function() {
            $(getElementSelector(container, elementIds.msmstooltip)).remove();
        });

        // SHOW / HIDE ION SERIES; UPDATE ON MASS TYPE CHANGE;
        // PEAK ASSIGNMENT TYPE CHANGED; PEAK LABEL TYPE CHANGED
        var ionChoiceContainer = $(getElementSelector(container, elementIds.ion_choice));
        ionChoiceContainer.find("input").click(function() {
            plotAccordingToChoices(container);
            });

            $(getElementSelector(container, elementIds.immoniumIons)).click(function() {
            plotAccordingToChoices(container);
            });

            $(getElementSelector(container, elementIds.reporterIons)).click(function() {
            plotAccordingToChoices(container);
            });

            $(getElementSelector(container, elementIds.labelPrecursor)).click(function() {
            plotAccordingToChoices(container);
        });

            // Peak detect checkbox
            $(getElementSelector(container, elementIds.peakDetect)).click(function() {
            container.data("peakAssignmentTypeChanged", true);
            plotAccordingToChoices(container);
            });

        container.find("input[name='"+getRadioName(container, "peakAssignOpt")+"']").click(function() {
            container.data("peakAssignmentTypeChanged", true);
            plotAccordingToChoices(container);
        });

            $(getElementSelector(container, elementIds.deselectIonsLink)).click(function() {
            ionChoiceContainer.find("input:checkbox:checked").each(function() {
            $(this).attr('checked', "");
            });

            plotAccordingToChoices(container);
        });

        container.find("input[name='"+getRadioName(container, "peakLabelOpt")+"']").click(function() {
            container.data("peakLabelTypeChanged", true);
            plotAccordingToChoices(container);
        });

        // CHANGING THE PLOT SIZE
        makePlotResizable(container);

        // PRINT SPECTRUM
        printPlot(container);
    }

    function resetZoom(container) {
        container.data("zoomRange", null);
        // setMassError(container);
        createPlot(container, getDatasets(container));
    }

    function plotAccordingToChoices(container) {
        var data = getDatasets(container);

        if (data.length > 0) {
                createPlot(container, data);
                makeIonTable(container);
            }
    }

    function resetAxisZoom(container) {

        var plot = container.data("plot");
        var plotOptions = container.data("plotOptions");

        var zoom_x = false;
        var zoom_y = false;
        if($(getElementSelector(container, elementIds.zoom_x)).is(":checked"))
            zoom_x = true;
        if($(getElementSelector(container, elementIds.zoom_y)).is(":checked"))
            zoom_y = true;
        if(zoom_x && zoom_y) {
            plotOptions.selection.mode = "xy";
            if(plot) plot.getOptions().selection.mode = "xy";
        }
        else if(zoom_x) {
            plotOptions.selection.mode = "x";
            if(plot) plot.getOptions().selection.mode = "x";
        }
        else if(zoom_y) {
            plotOptions.selection.mode = "y";
            if(plot) plot.getOptions().selection.mode = "y";
        }
    }

    function showTooltip(container, x, y, contents, options) {
        var tooltipCSS = {
                position: 'absolute',
                display: 'none',
                top: y + 5,
                left: x + 5,
                border: '1px solid #fdd',
                padding: '2px',
                'background-color': '#F0E68C',
                opacity: 0.80 };

        if ( options.tooltipZIndex !== undefined && options.tooltipZIndex !== null ) {
            tooltipCSS["z-index"] = options.tooltipZIndex;
        }

        $('<div id="'+getElementId(container, elementIds.msmstooltip)+'">' + contents + '</div>')
	    .css( tooltipCSS ).appendTo("body").fadeIn(200);
    }

    function makePlotResizable(container) {

        var options = container.data("options");

        $(getElementSelector(container, elementIds.slider_width)).slider({
            value:options.width,
            min: 100,
            max: 1500,
            step: 50,
            slide: function(event, ui) {
            var width = ui.value;
            //console.log(ui.value);
            options.width = width;
            $(getElementSelector(container, elementIds.msmsplot)).css({width: width});
                    $(getElementSelector(container, elementIds.massErrorPlot)).css({width: width});

            plotAccordingToChoices(container);
            if(options.ms1peaks && options.ms1peaks.length > 0) {
                $(getElementSelector(container, elementIds.msPlot)).css({width: width});
                createMs1Plot(container);
            }
            $(getElementSelector(container, elementIds.slider_width_val)).text(width);
            if ( options.sizeChangeCallbackFunction ) {
                options.sizeChangeCallbackFunction();
            }
	    }
	    });

        $(getElementSelector(container, elementIds.slider_height)).slider({
            value:options.height,
            min: 100,
            max: 1000,
            step: 50,
            slide: function(event, ui) {
            var height = ui.value;
            //console.log(ui.value);
            options.height = height
            $(getElementSelector(container, elementIds.msmsplot)).css({height: height});
            plotAccordingToChoices(container);
            $(getElementSelector(container, elementIds.slider_height_val)).text(height);
            if ( options.sizeChangeCallbackFunction ) {
                options.sizeChangeCallbackFunction();
            }
            }
        });
    }

    function printPlot(container) {

        $(getElementSelector(container, elementIds.printLink)).click(function() {

                var parent = container.parent();

            // create another div and move the plots into that div
            $(document.body).append('<div id="tempPrintDiv"></div>');
            $("#tempPrintDiv").append(container.detach());
            $("#tempPrintDiv").siblings().addClass("noprint");

            var plotOptions = container.data("plotOptions");

            container.find(".bar").addClass('noprint');
            $(getElementSelector(container, elementIds.optionsTable)).addClass('noprint');
            $(getElementSelector(container, elementIds.ionTableLoc1)).addClass('noprint');
            $(getElementSelector(container, elementIds.ionTableLoc2)).addClass('noprint');
            $(getElementSelector(container, elementIds.viewOptionsDiv)).addClass('noprint');

            plotOptions.series.peaks.print = true; // draw the labels in the DOM for sharper print output
            plotAccordingToChoices(container);
            window.print();

            // remove the class after printing so that if the user prints
            // via the browser's print menu the whole page is printed
            container.find(".bar").removeClass('noprint');
            $(getElementSelector(container, elementIds.optionsTable)).removeClass('noprint');
            $(getElementSelector(container, elementIds.ionTableLoc1)).removeClass('noprint');
            $(getElementSelector(container, elementIds.ionTableLoc2)).removeClass('noprint');
            $(getElementSelector(container, elementIds.viewOptionsDiv)).removeClass('noprint');
            $("#tempPrintDiv").siblings().removeClass("noprint");

            plotOptions.series.peaks.print = false; // draw the labels in the canvas
            plotAccordingToChoices(container);

            // move the plots back to the original location
                parent.append(container.detach());
            $("#tempPrintDiv").remove();

        });
    }

    // -----------------------------------------------
    // SELECTED DATASETS
    // -----------------------------------------------
    function getDatasets(container) {

        var options = container.data("options");

        // selected ions
	    var selectedIonTypes = getKoinaResultIonTypes(container);
	    calculateTheoreticalSeries(container, selectedIonTypes);

	    // add the un-annotated peaks
        //added two peak lists into data
        var peaks1 = {data: options.peaks,  color: "#bbbbbb", labelType: 'none', yaxis:1};
        //var peaks2 = {data: options.peaks2, color: "#bbbbbb", labelType: 'none', yaxis:2, label: options.ms2peaks2Label};
        var data = [];
        data.push(peaks1);
        //data.push(peaks2);

        // add the annotated peaks
        var seriesMatches = getSeriesMatches(container);
        for(var i = 0; i < seriesMatches.length; i += 1) {
            data.push(seriesMatches[i]);
        }

        return data;
    }


    //-----------------------------------------------
    // SELECTED ION TYPES
    // -----------------------------------------------
    function getKoinaResultIonTypes(container) {

        const annotations = container.data("options").annotations;

        const selectedIonTypes = [];
        const koinaIonTypes = new Set();
        for (let i = 0; i <  annotations.length; i += 1)
        {
            const annotation = annotations[i];
            const ionType = annotation.charAt(0);
            const plusIdx = annotation.indexOf('+');
            const charge = annotation.charAt(plusIdx + 1);
            koinaIonTypes.add(ionType + "" + charge);
        }

        for(const ionStr of koinaIonTypes)
        {
            const ion = Ion.get(ionStr.charAt(0), ionStr.charAt(1));
            selectedIonTypes.push(ion);
            // console.log("Adding to ion types: " + ion.label);
        }
       return selectedIonTypes;
    }

    function clearIonSeries(container)
    {
        container.data("ionSeriesMatch", {a: [], b: [], c: [], x: [], y: [], z: []});
        container.data("ionSeriesLabels", {a: [], b: [], c: [], x: [], y: [], z: []});
    }

    function getSeriesMatches(container)
    {
        const dataSeries = [];

        clearIonSeries(container);

        const ionSeries = container.data("ionSeries"); // theoretical ion series
        const ionSeriesMatch = container.data("ionSeriesMatch");
        const ionSeriesLabels = container.data("ionSeriesLabels");
        const peaks = container.data("options").peaks;
        const annotations = container.data("options").annotations;

        const koinaIonTypes = new Set();

        for (let i = 0; i < peaks.length; i += 1)
        {
            const annotation = annotations[i];
            const ionType = annotation.charAt(0);
            const plusIdx = annotation.indexOf('+');
            const ionIdx = annotation.substring(1, plusIdx);
            const charge = annotation.charAt(plusIdx + 1);
            console.log("Annotation: " + annotation + "; type: " + ionType + "; charge: " + charge + "; index: " + ionIdx);

            // if (ionSeriesMatch[ionType][charge]) continue;

            koinaIonTypes.add(ionType + "" + charge);

            const seriesMatch = ionSeriesMatch[ionType];
            const seriesLabel = ionSeriesLabels[ionType];
            if (seriesMatch)
            {
                const intensity = peaks[i][1];
                if (round(intensity) > 0) {
                    if (!seriesMatch[charge]) {
                        seriesMatch[charge] = [];
                        seriesLabel[charge] = [];
                    }
                    seriesMatch[charge].push(peaks[i]);
                    seriesLabel[charge].push(annotation);

                    if (ionSeries[ionType] && ionSeries[ionType][charge] && ionSeries[ionType][charge][ionIdx])
                    {
                        // ionSeries[ionType][charge][ionIdx] = Ion; e.g. b5+2; iontype = 'b', charge = 2, ionIdx = 5
                        ionSeries[ionType][charge][ionIdx].match = true;
                    }
                }
            }
        }

        for(const ionStr of koinaIonTypes)
        {
            // selectedIonTypes.push(ion = Ion.get(ionType, charge));
            // const ionStr = selectedIonTypes[j];
            const ion = Ion.get(ionStr.charAt(0), ionStr.charAt(1));
            // console.log("Selection ion: " + ionStr);
            const ionSeriesPeaks = ionSeriesMatch[ion.type][ion.charge];
            if (ionSeriesPeaks)
            {
                dataSeries.push({data: ionSeriesPeaks, color: ion.color, labelType: "ion", labels: ionSeriesLabels[ion.type][ion.charge]});
            }
        }
        return dataSeries;
    }

    // ---------------------------------------------------------
    // CALCULATE THEORETICAL MASSES FOR THE SELECTED ION SERIES
    // ---------------------------------------------------------
    function calculateTheoreticalSeries(container, selectedIons) {

        if(container.data("massTypeChanged"))
        {
            // Clear out the theoretical ion series if the selected mass type changed.
            container.data("ionSeries", {a: [], b: [], c: [], x: [], y: [], z: []});
        }
        if(selectedIons) {

            var todoIonSeries = [];
            var todoIonSeriesData = [];
            var ionSeries = container.data("ionSeries");
            for(var i = 0; i < selectedIons.length; i += 1) {
                var sion = selectedIons[i];
                if(sion.type == "a") {
                    if(ionSeries.a[sion.charge])	continue; // already calculated
                    else {
                        todoIonSeries.push(sion);
                        ionSeries.a[sion.charge] = [];
                        todoIonSeriesData.push(ionSeries.a[sion.charge]);
                    }
                }
                if(sion.type == "b") {
                    if(ionSeries.b[sion.charge])	continue; // already calculated
                    else {
                        todoIonSeries.push(sion);
                        ionSeries.b[sion.charge] = [];
                        todoIonSeriesData.push(ionSeries.b[sion.charge]);
                    }
                }
                if(sion.type == "c") {
                    if(ionSeries.c[sion.charge])	continue; // already calculated
                    else {
                        todoIonSeries.push(sion);
                        ionSeries.c[sion.charge] = [];
                        todoIonSeriesData.push(ionSeries.c[sion.charge]);
                    }
                }
                if(sion.type == "x") {
                    if(ionSeries.x[sion.charge])	continue; // already calculated
                    else {
                        todoIonSeries.push(sion);
                        ionSeries.x[sion.charge] = [];
                        todoIonSeriesData.push(ionSeries.x[sion.charge]);
                    }
                }
                if(sion.type == "y") {
                    if(ionSeries.y[sion.charge])	continue; // already calculated
                    else {
                        todoIonSeries.push(sion);
                        ionSeries.y[sion.charge] = [];
                        todoIonSeriesData.push(ionSeries.y[sion.charge]);
                    }
                }
                if(sion.type == "z") {
                    if(ionSeries.z[sion.charge])	continue; // already calculated
                    else {
                        todoIonSeries.push(sion);
                        ionSeries.z[sion.charge] = [];
                        todoIonSeriesData.push(ionSeries.z[sion.charge]);
                    }
                }
            }

            if(container.data("options").sequence) {

                const sequence = container.data("options").sequence
                const massType = "mono"; // getMassType(container);

                for(var i = 1; i < sequence.length; i += 1) {

                    for(var j = 0; j < todoIonSeries.length; j += 1) {
                        var tion = todoIonSeries[j];
                        var ionSeriesData = todoIonSeriesData[j];

                        var ion = Ion.getSeriesIon(tion, container.data("options").peptide, i, massType);
                        // Put the ion masses in increasing value of m/z, For c-term ions the array will have to be
                        // populated backwards.
                        if(tion.term == "n")
                            // Add to end of array
                            ionSeriesData.push(ion);
                        else if(tion.term == "c")
                            // Add to beginning of array
                            ionSeriesData.unshift(ion);
                    }
                }
            }
        }
    }


    // -----------------------------------------------
    // INITIALIZE THE CONTAINER
    // -----------------------------------------------
    function createContainer(div) {

        div.append('<div id="'+elementIds.lorikeet_content+"_"+index+'"></div>');
        var container = $("#"+ div.attr('id')+" > #"+elementIds.lorikeet_content+"_"+index);
        container.addClass("lorikeet");
        return container;
    }

    function initContainer(container) {

        var options = container.data("options");

        var rowspan = 2;

	    var parentTable = '<table cellpadding="0" cellspacing="5" class="lorikeet-outer-table"> ';
	    parentTable += '<tbody> ';

        // placeholders for the ms/ms plot
        parentTable += '<tr> ';
        parentTable += '<td style="background-color: white; padding:5px; border:1px dotted #cccccc;" valign="top" align="center"> ';
        parentTable += '<div id="'+getElementId(container, elementIds.msmsplot)+'" align="bottom" style="width:'+options.width+'px;height:'+options.height+'px;"></div> ';

        // placeholder for viewing options (zoom, plot size etc.)
        parentTable += '<div id="'+getElementId(container, elementIds.viewOptionsDiv)+'" align="top" style="margin-top:15px;"></div> ';
        parentTable += '</td> ';

        if(options.showIonTable) {
            // placeholder for the ion table
            parentTable += '<td rowspan="'+rowspan+'" valign="top" id="'+getElementId(container, elementIds.ionTableLoc1)+'" > ';
            parentTable += '<div id="'+getElementId(container, elementIds.ionTableDiv)+'">';
            parentTable += '</div> ';
            parentTable += '</td> ';
        }

        parentTable += '</tr> ';

	    parentTable += '</tbody> ';
	    parentTable += '</table> ';

	    container.append(parentTable);

	    return container;
    }


    //---------------------------------------------------------
    // ION TABLE
    //---------------------------------------------------------
    function makeIonTable(container) {

        var options = container.data("options");

        // selected ions
        var selectedIonTypes = getKoinaResultIonTypes(container);
        var ntermIons = getNtermIons(selectedIonTypes);
        console.log(ntermIons);
        var ctermIons = getCtermIons(selectedIonTypes);
        console.log(ctermIons);

        var myTable = '' ;
        myTable += '<table id="'+getElementId(container, elementIds.ionTable)+'" cellpadding="2" class="font_small '+elementIds.ionTable+'">';
        myTable +=  "<thead>";
        myTable +=   "<tr>";

        // nterm ions
        for(var i = 0; i < ntermIons.length; i += 1) {
            myTable +=    "<th>" +ntermIons[i].label+  "</th>";
        }
        myTable +=    "<th>" +"#"+  "</th>";
        myTable +=    "<th>" +"Seq"+  "</th>";
        myTable +=    "<th>" +"#"+  "</th>";
        // cterm ions
        for(var i = 0; i < ctermIons.length; i += 1) {
            myTable +=    "<th>" +ctermIons[i].label+  "</th>";
        }
        myTable +=   "</tr>";
        myTable +=  "</thead>";

        myTable +=  "<tbody>";

        // var ionSeriesMatch = container.data("ionSeriesMatch");
        const ionSeries = container.data("ionSeries");

        for(var i = 0; i < options.sequence.length; i += 1) {
           var aaChar = options.sequence.charAt(i);
            myTable +=   "<tr>";

            // nterm ions
            for(var n = 0; n < ntermIons.length; n += 1) {
                if(i < options.sequence.length - 1) {
                    var seriesData = getCalculatedSeries(ionSeries, ntermIons[n]);
                    var cls = "";
                    var style = "";
                    if(seriesData[i].match) {
                        cls="matchIon";
                        style="style='background-color:"+Ion.getSeriesColor(ntermIons[n])+";'";
                    }
                    else if(seriesData[i].mz < options.peaks[0][0] |
                        seriesData[i].mz > options.peaks[options.peaks.length - 1][0]) {
                        cls="numCell";
                    }
                    myTable +=    "<td class='"+cls+"' "+style+" >" +round(seriesData[i].mz)+  "</td>";
                }
                else {
                    myTable +=    "<td>" +"&nbsp;"+  "</td>";
                }
            }

            myTable += "<td class='numCell'>"+(i+1)+"</td>";
            myTable += "<td class='seq'>"+aaChar+"</td>";
            myTable += "<td class='numCell'>"+(options.sequence.length - i)+"</td>";

            // cterm ions
            for(var c = 0; c < ctermIons.length; c += 1) {
                if(i > 0) {
                    var seriesData = getCalculatedSeries(ionSeries, ctermIons[c]);
                    var idx = options.sequence.length - i - 1;
                    var cls = "";
                    var style = "";
                    if(seriesData[idx].match) {
                        cls="matchIon";
                        style="style='background-color:"+Ion.getSeriesColor(ctermIons[c])+";'";
                    }
                    else if(seriesData[idx].mz < options.peaks[0][0] |
                                    seriesData[idx].mz > options.peaks[options.peaks.length - 1][0]) {
                    cls="numCell";
                    }
                    myTable +=    "<td class='"+cls+"' "+style+" >" +round(seriesData[idx].mz)+  "</td>";
                    // myTable +=    "<td class='"+cls+"' "+style+" >" +round(0.00)+  "</td>";
                }
                else {
                    myTable +=    "<td>" +"&nbsp;"+  "</td>";
                }
            }
	    }
        myTable +=   "</tr>";

        myTable += "</tbody>";
        myTable += "</table>";

        // alert(myTable);
        $(getElementSelector(container, elementIds.ionTable)).remove();
        $(getElementSelector(container, elementIds.ionTableDiv)).prepend(myTable); // add as the first child

        if ( options.sizeChangeCallbackFunction ) {
            options.sizeChangeCallbackFunction();
        }
    }

    function getCalculatedSeries(ionSeries, ion) {
        if(ion.type == "a")
            return ionSeries.a[ion.charge];
        if(ion.type == "b")
            return ionSeries.b[ion.charge];
        if(ion.type == "c")
            return ionSeries.c[ion.charge];
        if(ion.type == "x")
            return ionSeries.x[ion.charge];
        if(ion.type == "y")
            return ionSeries.y[ion.charge];
        if(ion.type == "z")
            return ionSeries.z[ion.charge];
    }

    function getSeriesMatch(ionSeriesMatch, ion) {
        if(ion.type == "a")
            return ionSeriesMatch.a[ion.charge];
        if(ion.type == "b")
            return ionSeriesMatch.b[ion.charge];
        if(ion.type == "c")
            return ionSeriesMatch.c[ion.charge];
        if(ion.type == "x")
            return ionSeriesMatch.x[ion.charge];
        if(ion.type == "y")
            return ionSeriesMatch.y[ion.charge];
        if(ion.type == "z")
            return ionSeriesMatch.z[ion.charge];
    }


    function getNtermIons(selectedIonTypes) {
        var ntermIons = [];

        for(var i = 0; i < selectedIonTypes.length; i += 1) {
            var sion = selectedIonTypes[i];
            if(sion.type == "a" || sion.type == "b" || sion.type == "c")
            {
                ntermIons.push(sion);
            }
        }
        ntermIons.sort(function(m,n) {
            if(m.type == n.type) {
                return (m.charge - n.charge);
            }
            else {
                return m.type - n.type;
            }
        });
        return ntermIons;
    }

    function getCtermIons(selectedIonTypes) {
        var ctermIons = [];

        for(var i = 0; i < selectedIonTypes.length; i += 1) {
            var sion = selectedIonTypes[i];
            if(sion.type == "x" || sion.type == "y" || sion.type == "z")
                ctermIons.push(sion);
        }
        ctermIons.sort(function(m,n) {
            if(m.type == n.type) {
                return (m.charge - n.charge);
            }
            else {
                return m.type - n.type;
            }
        });
        return ctermIons;
    }

    //---------------------------------------------------------
    // VIEWING OPTIONS TABLE
    //---------------------------------------------------------
    function makeViewingOptions(container) {

        var options = container.data("options");

        var myContent = '';

        // reset zoom option
        myContent += '<nobr> ';
        myContent += '<span style="width:100%; font-size:8pt; margin-top:5px; color:sienna;">Click and drag in the plot to zoom</span> ';
        myContent += 'X:<input id="'+getElementId(container, elementIds.zoom_x)+'" type="checkbox" value="X" checked="checked"/> ';
        myContent += '&nbsp;Y:<input id="'+getElementId(container, elementIds.zoom_y)+'" type="checkbox" value="Y" /> ';
        myContent += '&nbsp;<input id="'+getElementId(container, elementIds.resetZoom)+'" type="button" value="Zoom Out" /> ';
        // myContent += '&nbsp;<input id="'+getElementId(container, elementIds.printLink)+'" type="button" value="Print" /> ';
        myContent += '</nobr> ';

        myContent += '&nbsp;&nbsp;';

        // tooltip option
        myContent += '<nobr> ';
        myContent += '<label><input id="'+getElementId(container, elementIds.enableTooltip)+'" type="checkbox">Enable tooltip </label>';
        myContent += '</nobr> ';

        myContent += '<br>';

        $(getElementSelector(container, elementIds.viewOptionsDiv)).append(myContent);
        if(!options.showViewingOptions) {
                $(getElementSelector(container, elementIds.viewOptionsDiv)).hide();
        }
    }

})(jQuery);
