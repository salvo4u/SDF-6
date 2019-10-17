function updateConfig() {

    var CONFIG_REC = 'customrecord_st_configrecord';
    var currDate = new Date();
    var currDateStr = nlapiDateToString(currDate);
    var rec = nlapiLoadRecord(CONFIG_REC, 1);
    rec.setFieldValue('custrecord_st_installedon', currDateStr);
    nlapiSubmitRecord(rec);
}