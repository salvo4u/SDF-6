/// <reference path="../nlapihandler.js" />
function createDBRecord(request, response) {

    var obj = JSON.parse(request.getBody());

    nlapiLogExecution('DEBUG', 'Recieved Data', JSON.stringify(obj));
    
    if (obj.jobid || false) {
        var timeStamp = obj.timestamp.slice(0, -3) + ":00" + obj.timestamp.slice(-3);

        var rec = nlapiCreateRecord('customrecord_st_db');
        rec.setFieldValue('custrecord_st_time', timeStamp)
        rec.setFieldText('custrecord_st_operation', obj.operation)
        rec.setFieldValue('custrecord_st_recordtype', obj.recordtype)
        rec.setFieldValue('custrecord_st_jobid', obj.jobid)
        rec.setFieldValue('custrecord_st_recordid', obj.recid);
        var id = nlapiSubmitRecord(rec);
        nlapiLogExecution('DEBUG', 'Created DB Rec Id', id);
    }

    response.write('success');
}