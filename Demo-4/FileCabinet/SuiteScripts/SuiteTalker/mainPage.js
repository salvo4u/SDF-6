/// <reference path="../nlapihandler.js" />
function setParallel(dataObj) {

    var p = new Parallel(dataObj),
    onComplete = function () {
        console.log("completed");
        document.getElementById("content").innerHTML = "Completed";
        document.getElementById("processingimg").src = "";
        document.getElementById("lastbuilddate").innerHTML = onPageLoad();
    };

    function createRecods(obj) {
        function httpGet(theUrl, obj) {
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open("POST", theUrl, false); // false for synchronous request
            xmlHttp.setRequestHeader("Content-type", "application/json");
            xmlHttp.send(JSON.stringify(obj));
            return xmlHttp.responseText;
        }
        //console.log(obj);
        try {
            var resp = httpGet("https://system.netsuite.com/app/site/hosting/scriptlet.nl?script=customscript_st_createdbrecs&deploy=customdeploy_st_createdbrecs", obj);
            //console.log('resp is' + resp);
        } catch (e) {
            console.log(e);
        }
    };

    p.map(createRecods).then(onComplete);
}

function buildIndex() {

    var stDate = new Date();
    console.log('buildIndex invoked');

    //Build URL
    var constURL = 'https://system.netsuite.com/app/common/search/searchresults.nl?searchtype=WSOperation&frame=B&style=NORMAL&sortcol=WSOperation_TIME_raw&sortdir=DESC&csv=HTML&OfficeXML=F&pdf=&size=50&twbx=F&report=&grid=';

    //perform search on config record
    var webServConfigSearchFilter = new nlobjSearchFilter('isinactive', null, 'is', 'F');
    var webServConfigSearchColumn = new nlobjSearchColumn('custrecord_st_defsearchws');

    var search = nlapiSearchRecord('customrecord_st_configrecord', null, webServConfigSearchFilter, webServConfigSearchColumn);
    if (search && search.length == 1) {
        var searchId = search[0].getValue(webServConfigSearchColumn);
    } else {
        console.log('Main Saved Search Not Set');
        return;
    }

    console.log('search Id returned ' + searchId);

    //perform search on DB to get last job ID and time
    var dbSearchCol = [];
    dbSearchCol.push(new nlobjSearchColumn('custrecord_st_time').setSort(true));
    dbSearchCol.push(new nlobjSearchColumn('internalid').setSort(true));
    dbSearchCol.push(new nlobjSearchColumn('custrecord_st_jobid'));
    var lastIndexDate;
    var lastJobId = '';
    var dbSearch = nlapiSearchRecord('customrecord_st_db', null, null, dbSearchCol);
    if (dbSearch && dbSearch.length > 0) {
        var dateStr = dbSearch[0].getValue(dbSearchCol[0]);
        lastIndexDate = new Date(dateStr.split(' ')[0]);
        lastJobId = dbSearch[0].getValue(dbSearchCol[2]);
    } else {

        //get installation date
        var configSearchCol = [];
        configSearchCol.push(new nlobjSearchColumn('custrecord_st_installedon'));
        var configSearch = nlapiSearchRecord('customrecord_st_configrecord', null, null, configSearchCol);
        if (configSearch && configSearch.length > 0) {
            lastIndexDateStr = configSearch[0].getValue(configSearchCol[0]);
            lastIndexDate = new Date(lastIndexDateStr);
        } else {
            lastIndexDate = new Date() //setting to todays date 
        }
    }

    console.log('lastIndexDate ' + lastIndexDate + ' jobId ' + lastJobId);

    //implement timezone aware code --later

    //get current time
    var currDate = new Date();
    var curryyyy = currDate.getFullYear().toString();
    var currMM = (currDate.getMonth() + 1).toString();
    var currdd = currDate.getDate().toString();

    //last Index time
    var lastyyyy = lastIndexDate.getFullYear().toString();
    var lastMM = (lastIndexDate.getMonth() + 1).toString();
    var lastdd = lastIndexDate.getDate().toString();

    var segment = 0;
    var startIndex = 0;

    var allRecTOProcess = [];
    whileLoop:
        while (1) {
            var finalURL = '';
            finalURL = constURL + '&searchid=' + searchId + '&segment=' + segment + '%02' + startIndex + '%02' + currMM + '%2F' + currdd + '%2F' + curryyyy + '%02' + lastMM + '%2F' + lastdd + '%2F' + lastyyyy

            console.log('final URL ' + finalURL);

            var response = nlapiRequestURL(finalURL);
            var content = response.getBody();

            //console.log('Content is ' + content);
            //parse HTML Content
            var currRecToProcess = parseHTMLToObj(content);
            if (!currRecToProcess || currRecToProcess.length == 0) {
                break;
            }

            //find JOBID
            for (var i = 0; i < currRecToProcess.length; i++) {
                if (currRecToProcess[i].jobid == lastJobId) {
                    console.log('----JOBID Found-----' + i)
                    console.log('slice ' + currRecToProcess.slice(0, i));
                    currRecToProcess = currRecToProcess.slice(0, i);

                    allRecTOProcess = allRecTOProcess.concat(currRecToProcess);
                    break whileLoop;
                }
            }

            if (currRecToProcess.length > 0) {
                allRecTOProcess = allRecTOProcess.concat(currRecToProcess);
            }

            //Incremntal for while loop
            segment += 1;
            startIndex += 50;

            //hard stop for test
            if (segment == 20) {
                break;
            }
        }

    console.log('allRecTOProcess' + JSON.stringify(allRecTOProcess))
    setParallel(allRecTOProcess);

    var enDate = new Date();
    var timeDiff = enDate - stDate;
    console.log('Time Elapsed ' + timeDiff);
    document.getElementById("processingimg").src = "https://system.netsuite.com/core/media/media.nl?id=26732&c=TSTDRV1151650&h=d21220a8cc13f3735dcc";
    document.getElementById("content").innerHTML = "Processing Records " + allRecTOProcess.length;
}

function parseHTMLToObj(htmlContent) {

    parser = new DOMParser();
    var doc = parser.parseFromString(htmlContent, "text/html");
    var table = doc.getElementById("div__bodytab").innerHTML;
    table = table.slice(7, -8);
    table = "<html><table>" + table + "</table></html>";

    var finalObj = [];
    var counter = 0;
    while (1) {
        var keyObj = "row" + counter;

        var row = parser.parseFromString(table, "text/html");
        if (row.getElementById(keyObj)) {
            var txt = row.getElementById(keyObj).innerHTML;

            var styleRegex = /style/g;
            var tdRegex = /<\/td>/g;

            var styleResult = [];
            var match;
            while (match = styleRegex.exec(txt)) {
                styleResult.push(match.index);
            }

            var tdResult = [];
            var match;
            while (match = tdRegex.exec(txt)) {
                tdResult.push(match.index);
            }
            var obj = {};

            //console.log('styleResult --> ' +  keyObj +' --> ' + styleResult);

            for (var i = 0; i < styleResult.length; i++) {
                //finalObj[keyObj] = {};
                var rowStr = txt.slice(styleResult[i] + 9, tdResult[i]);
                if (rowStr == 'No Search Results Match Your Criteria.') {
                    return [];
                }
                if (i == 0) {
                    //console.log(rowStr);
                    obj.timestamp = rowStr;
                }
                else if (i == 1) {
                    //console.log(rowStr);
                    obj.operation = rowStr;
                }
                else if (i == 2) {
                    //console.log(rowStr);
                    obj.recordtype = rowStr;
                }
                else if (i == 3) {
                    obj.jobid = rowStr;
                }
                else if (i == 4) {
                    //console.log(rowStr);
                    var link = (rowStr.slice(rowStr.indexOf("href"), rowStr.indexOf("target") - 2));
                    var id = link.slice(link.indexOf("id=") + 3);
                    //console.log(id);
                    obj.recid = id;
                }
            }
            finalObj[counter] = obj;

            counter++;
        }
        else {
            break;
        }
    }
    console.log('Final Obj ' + JSON.stringify(finalObj));
    return finalObj;
}

function getSearchRes() {
    var recId = document.getElementById('recid').value;
    console.log(recId);

    //perform search on DB to get last job ID and time
    var dbSearchFil = [];
    dbSearchFil.push(new nlobjSearchFilter('custrecord_st_recordid', null, 'is', recId));

    var dbSearchCol = [];
    dbSearchCol.push(new nlobjSearchColumn('custrecord_st_time').setSort(true));
    dbSearchCol.push(new nlobjSearchColumn('custrecord_st_jobid'));

    var dbSearch = new nlapiSearchRecord('customrecord_st_db', null, dbSearchFil, dbSearchCol);
    if (dbSearch && dbSearch.length > 0) {
        var jobId = dbSearch[0].getValue(dbSearchCol[1]);
        var logTime = dbSearch[0].getValue(dbSearchCol[0]);

        var reqURL = 'https://system.netsuite.com/app/webservices/wslog.nl?req=T&jobid=' + jobId;
        var req = nlapiRequestURL(reqURL);
        var reqContent = req.getBody();

        var respURL = 'https://system.netsuite.com/app/webservices/wslog.nl?req=F&jobid=' + jobId;
        var resp = nlapiRequestURL(respURL);
        var respContent = resp.getBody();

        console.log('req content is -->' + reqContent);
        console.log('resp content is -->' + respContent);

        document.getElementById("searchmessage").innerHTML = "Record logged at " + logTime;

        document.getElementById('request').innerHTML = reqContent.toString();
        document.getElementById('response').innerHTML = respContent.toString();
        //document.getElementById('requestobj').innerHTML = JSON.stringify(xmlToJson(StringToXML(reqContent)), null,'\t');
        //document.getElementById('response').innerHTML = formatXml(reqContent);


    } else {
        document.getElementById("searchmessage").innerHTML = "Not found";
    }
}

function installedDate() {
    var configSearchCol = [];
    configSearchCol.push(new nlobjSearchColumn('custrecord_st_installedon'));
    var configSearch = nlapiSearchRecord('customrecord_st_configrecord', null, null, configSearchCol);
    if (configSearch && configSearch.length > 0) {
        lastIndexDateStr = configSearch[0].getValue(configSearchCol[0]);
        return 'Installed On: '+ lastIndexDateStr
    } else {
        return null;
    }
}

function lastIndexDate() {
    console.log('onload')
    var dbSearchCol = [];
    dbSearchCol.push(new nlobjSearchColumn('custrecord_st_time').setSort(true));
    dbSearchCol.push(new nlobjSearchColumn('custrecord_st_jobid'));

    var dbSearch = new nlapiSearchRecord('customrecord_st_db', null, null, dbSearchCol);
    if (dbSearch && dbSearch.length > 0) {
        var lastIndexDate = dbSearch[0].getValue(dbSearchCol[0]);
    }
    console.log('lastIndexDate ' + lastIndexDate);
    var retTxt = 'Last Index happended on ' + lastIndexDate;
    return retTxt;
}

function xmlToJson(xml) {

    xml = clean(xml);
    // Create the return object
    var obj = {};

    if (xml.nodeType == 1) { // element
        // do attributes
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (var j = 0; j < xml.attributes.length; j++) {
                var attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType == 3) { // text
        obj = xml.nodeValue;
    }

    // do children
    if (xml.hasChildNodes()) {
        for (var i = 0; i < xml.childNodes.length; i++) {
            var item = xml.childNodes.item(i);
            var nodeName = item.nodeName;
            if (typeof (obj[nodeName]) == "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof (obj[nodeName].push) == "undefined") {
                    var old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    return obj;
}

function StringToXML(oString) {

    //code for IE
    if (window.ActiveXObject) {
        var oXML = new ActiveXObject("Microsoft.XMLDOM"); oXML.loadXML(oString);
        return oXML;
    }
        // code for Chrome, Safari, Firefox, Opera, etc. 
    else {
        return (new DOMParser()).parseFromString(oString, "text/xml");
    }
}

function clean(node) {
    for (var n = 0; n < node.childNodes.length; n++) {
        var child = node.childNodes[n];
        if
    (
        child.nodeType === 8
        ||
        (child.nodeType === 3 && !/\S/.test(child.nodeValue))
        ) {
            node.removeChild(child);
            n--;
        }
        else if (child.nodeType === 1) {
            clean(child);
        }
    }
    return node;
}

function formatXml(xml) {
    var formatted = '';
    var reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    var pad = 0;
    jQuery.each(xml.split('\r\n'), function (index, node) {
        var indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0;
        }
        else if (node.match(/^<\/\w/)) {
            if (pad != 0) {
                pad -= 1;
            }
        }
        else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1;
        }
        else {
            indent = 0;
        }
        var padding = '';
        for (var i = 0; i < pad; i++) {
            padding += '  ';
        }
        formatted += padding + node + '\r\n';
        pad += indent;
    });

    console.log('-----------formatted---------' + formatted)
    return formatted;
}