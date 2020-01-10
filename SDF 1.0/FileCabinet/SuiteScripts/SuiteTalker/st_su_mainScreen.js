/// <reference path="../nlapihandler.js" />
function mainPage(request, response) {
   
    //constants
    var MAINPAGE_HTML_FILEID = '26725'

    var file = nlapiLoadFile(MAINPAGE_HTML_FILEID);
    var content = file.getValue();

    var form = nlapiCreateForm('SuiteTalker');
    var htmlContent = form.addField('htmlcontent', 'inlinehtml');
    htmlContent.setDefaultValue(content);

    response.writePage(form);
}