/* 
 * Copyright (c) 2020 NIBIO <http://www.nibio.no/>. 
 * 
 * This file is part of MockPlatform.
 * MockPlatform is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * MockPlatform is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with MockPlatform.  If not, see <http://www.gnu.org/licenses/>.
 * 
 */

var EPPO_TAXON_WEB_ENDPOINT = "https://gd.eppo.int/taxon/";


function init (){
    Vue.use(VueJsonSchemaForm.default);
    
    var app = new Vue({
        el:"#app",
        data: {
            DSSList: [],
            weatherDataSourceList: [],
            weatherParameterList: {},
            currentModel: {},
            currentModelVisible: false,
            currentDataSource: {},
            currentDataSourceVisible: false,
            showResults: false,
            theFormSchema: null,
            weatherDataSchema: null,
            formData: {},
            dataSourceSpatialInfo: null,
            latitude: null,
            longitude: null,
            altitude: null,
            selectedWeatherStationId: null,
            weatherData: null,
            resultsData: [],
            resultsColumns: [
                
            ]
        },
        methods: {
            renderNamesFromEPPOCodes:renderNamesFromEPPOCodes,
//            renderRunModelForm: renderRunModelForm,
            handleModelSelect(selectedDSSModel){
                this.showResults=false;
                this.currentModel = selectedDSSModel; 
                this.theFormSchema = JSON.parse(this.currentModel.How_to_run.Input_schema); 
                this.theFormSchema.properties.weatherData = false; // Needs rewriting!
                //this.theFormSchema.properties.weatherData = this.weatherDataSchema; // This needs rerwriting
                this.currentModelVisible = true;
                renderNamesFromEPPOCodes(this.currentModel);
            },
            handleWeatherDataSourceSelect(selectedDataSource){
                this.currentDataSource = selectedDataSource;
                
                var dataSourceSpatialInfoTmp = JSON.parse(this.currentDataSource.Spatial);
                // Sort stations alphabetically
                if(this.currentDataSource.Access_type=='stations')
                {
                    dataSourceSpatialInfoTmp.features.sort(function(a,b){
                        return a.properties.name > b.properties.name ? 1 : -1;
                    });
                }
                this.dataSourceSpatialInfo = dataSourceSpatialInfoTmp;
                // If the resource is gridded, the Spatial property is a polygon
                // Otherwise, it's a FeatureCollection of points and this means it's a list of weather stations
                this.currentDataSourceVisible = true;
            },
            displayData: function(){
                console.info(this.formData);
                console.info(JSON.stringify(this.formData));
            },
            submitData: function(){
                
                //
                //this.displayData();
                
                // Get weather data first
                // Which parameters, period, station etc
                var locationIdentifier = this.currentDataSource.Access_type == "grid" ?
                    "&latitude=" + this.latitude + "&longitude=" + this.longitude + "&altitude=" + this.altitude
                    :"&stationId=" + this.selectedWeatherStationId;
                // TODO make sure we get proper timezone aware timestamps from the form
                // Use local time zone (browser based) for now. Should use user's time zone defined in platform normally?
                var timeStart=moment.tz(this.formData.configParameters.timeStart, this.formData.configParameters.timeZone).format().replace("+","%2B");
                //console.info(moment.tz(this.formData.configParameters.timeStart, this.formData.configParameters.timeZone).format());
                var timeEnd=moment.tz(this.formData.configParameters.timeEnd, this.formData.configParameters.timeZone).format().replace("+","%2B");
                var interval= this.currentModel.Input.Weather[0].interval; // TODO get from model
                var parameters = [];
                for(var i=0;i<this.currentModel.Input.Weather.length;i++)
                {
                    parameters.push(this.currentModel.Input.Weather[i].parameter_code);
                }
                //console.info(locationIdentifier);
                fetch(this.currentDataSource.Endpoint 
                    + "?timeStart=" + timeStart 
                    + "&timeEnd=" + timeEnd 
                    + "&interval=" + interval 
                    + "&weatherStationId=" + this.selectedWeatherStationId
                    + "&parameters=" + parameters.join(","),
                {
                    method: "GET",
                    mode: "cors",
                    cache: "no-cache",
                    credentials: "same-origin",
                    redirect: 'follow',
                    referrerPolicy: 'no-referrer'
                })
                .then((response) => response.json())
                .then((data) => {
                    this.weatherData = data;
                    this.formData.weatherData = this.weatherData;
                    serializedFormData = JSON.stringify(this.formData);
                    return fetch(this.currentModel.How_to_run.Endpoint, {
                        method: "POST",
                        mode: "cors",
                        cache: "no-cache",
                        credentials: "same-origin",
                        headers: {
                            "Content-type": "application/json; charset=utf-8"
                        },
                        redirect: 'follow',
                        referrerPolicy: 'no-referrer',
                        body: serializedFormData
                    })
                    .then((response) => response.json())
                    .then((data) => {console.info(data);this.renderResults(data);})
                    .then()
                    .catch((error) => console.error("Error:", error));
                    
                });

                
            },
            renderResults: function(resultList){
                this.resultsData = [];
                this.resultsColumns = [
                    {field: "validTimeStart", label:"Time"},
                    {field: "warningStatus", label:"Warning status"}
                ];
                var allKeys = JSON.parse(resultList[0].keys);
                for(var i in allKeys)
                {
                    var fieldKey = allKeys[i].split(".")[allKeys[i].split(".").length - 1];
                    this.resultsColumns.push({ field:fieldKey, label:allKeys[i] });
                }
                resultList.reverse();
                for(var j in resultList)
                {
                    var resultLine = resultList[j];
                    var resultOut = {};
                    resultOut["validTimeStart"] = moment.tz(resultLine.validTimeStart, this.formData.configParameters.timeZone).format();
                    resultOut["warningStatus"] = resultLine.warningStatus;
                        
                    var allResultsFromLine = JSON.parse(resultLine.allValues);
                    //console.info(allResultsFromLine);
                    for(var i in allKeys)
                    {
                        var fieldKey = allKeys[i].split(".")[allKeys[i].split(".").length - 1];
                        resultOut[fieldKey] = allResultsFromLine[allKeys[i]];
                    }
                    
                    //console.info(resultOut);
                    this.resultsData.push(resultOut);
                }
                this.showResults=true;
            }
            ,
            testGetWeatherData: function() {
                // Get weather data first
                // Which parameters, period, station etc
                var locationIdentifier = this.currentDataSource.Access_type == "grid" ?
                    "&latitude=" + this.latitude + "&longitude=" + this.longitude + "&altitude=" + this.altitude
                    :"&stationId=" + this.selectedWeatherStationId;
                // TODO make sure we get proper timezone aware timestamps from the form
                var timeStart=encodeURIComponent("2020-04-01T00:00:00+02:00");
                var timeEnd=encodeURIComponent("2020-04-30T00:00:00+02:00");
                var interval=3600; // TODO get from form
                var parameters=[1002]
                console.info(locationIdentifier);
                fetch(this.currentDataSource.Endpoint 
                    + "?timeStart=" + timeStart 
                    + "&timeEnd=" + timeEnd 
                    + "&interval=" + interval 
                    + "&weatherStationId=" + this.selectedWeatherStationId
                    + "&parameters=" + parameters.join(","),
                {
                    method: "GET",
                    mode: "cors",
                    cache: "no-cache",
                    credentials: "same-origin",
                    redirect: 'follow',
                    referrerPolicy: 'no-referrer'
                })
                .then((response) => response.json())
                .then((data) => {this.weatherData = data;});
                
                
            }
        },
        created(){
            fetch(DSSServiceHost + "/rest/list")
            .then(response => response.json())
            .then(json=>{
                this.DSSList = json;
            });
            fetch(WeatherServiceHost + "/rest/weatherdatasource/list")
            .then(response => response.json())
            .then(json=>{
                //console.info(json);
                this.weatherDataSourceList = json.Datasources;
            });
            fetch(WeatherServiceHost + "/rest/schema/weatherdata")
            .then(response => response.json())
            .then(json=>{
                this.weatherDataSchema = json
            });

            fetch(WeatherServiceHost + "/rest/parameter/list")
            .then(response => response.json())
            .then(json=>{
                //console.info(json);
                for(var i in json.parameters)
                {
                    var param = json.parameters[i];
                    //console.info(param);
                    this.weatherParameterList[param.id] = param;
                }
                //console.info(this.weatherParameterList);
            });
        }
    });
}


var weatherDataSources; // Keeping datasources in memory
var EPPORestAPIURL = "https://data.eppo.int/api/rest/1.0/";


/**
 * Using Alpaca forms for this: http://alpacajs.org/
 * @param {Object} DSSModel 
 */
var renderRunModelForm = function(DSSModel)
{
    //console.info(DSSModel.How_to_run.Input_schema);
    var formSchema = JSON.parse(DSSModel.How_to_run.Input_schema);
    //console.info(formSchema);
    document.getElementById("runModelForm").innerHTML = "";
    $("#runModelForm").alpaca({
        "schema": formSchema,
        "options": {
            "form": {
                "attributes": {
                    "action": DSSModel.How_to_run.Endpoint,
                    "method": DSSModel.How_to_run.Form_method,
                    "enctype": DSSModel.How_to_run.Content_type,
                    "onclick": "console.info(\"BLABLA\");return false"
                },
                "buttons": {
                    "submit": {}
                }
            }
        },
        "view": "web-edit"
    });
}

/**
 * 
 * @param {Object} DSSModel
 * @returns {undefined}
 */
var renderNamesFromEPPOCodes = function(DSSModel)
{
    var EPPOCodes = DSSModel.Pests.concat(DSSModel.Crops)
    var promises = [];
    for(var i=0;i<EPPOCodes.length;i++)
    {
        var EPPOCode = EPPOCodes[i];
        var resolveFunction = function(resolve,reject) {
                    ajax(
                            EPPORestAPIURL + "taxon/" + EPPOCode + "/names?authtoken=" + EPPO_AUTHTOKEN, 
                            function(e){
                                var jsonResponse = JSON.parse(e.target.responseText);
                                var codeArray = [this.parameters.EPPOCode, jsonResponse];
                                resolve(codeArray);
                            },
                            {EPPOCode:EPPOCode} // Value can be retrieved in callback using this.parameters.EPPOCode
                    );
            }
        var promise = new Promise(resolveFunction);
        promises.push(promise);
    }
    var retVal = new Object();
    
    // Remember that all logic must come inside the Promise to be executed
    // in the correct order.....
    Promise.all(promises).then(function(arrayOfResults){
        for(var i=0;i<arrayOfResults.length;i++)
        {
            retVal[arrayOfResults[i][0]] = arrayOfResults[i][1];
        }
        

        var html = "<p><strong>Crops:</strong> ";
        var cropItems = [];
        for(var i=0;i<DSSModel.Crops.length;i++)
        {
            cropItems.push("<a href=\"" + EPPO_TAXON_WEB_ENDPOINT  + DSSModel.Crops[i]+ "\" target=\"new\">" + getEPPOName(retVal[DSSModel.Crops[i]],LANGUAGE) + "</a>");
        }
        html += cropItems.join(", ");
        
        html +="</p><p><strong>Pests: </strong>";
        var pestItems = [];
        for(var i=0;i<DSSModel.Pests.length;i++)
        {
            pestItems.push("<a href=\"" + EPPO_TAXON_WEB_ENDPOINT + DSSModel.Pests[i]+ "\" target=\"new\">" + getEPPOName(retVal[DSSModel.Pests[i]],LANGUAGE) + "</a>");
        }
        html += pestItems.join(", ");
        
        document.getElementById("cropsAndPests").innerHTML = html;
        
    });
    
    
};

var getEPPOName = function(nameInfo, language)
{
    //console.info(nameInfo);
    for(var i=0;i<nameInfo.length;i++)
    {
        if(nameInfo[i].isolang === language)
        {
            return nameInfo[i].fullname;
        }
    }
    // Default latin
    return nameInfo[0].fullname;
}

