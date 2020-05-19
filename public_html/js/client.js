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
            fieldObservationSchema: null,
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
            handleModelSelect(selectedDSSModel){
                this.showResults=false;
                this.currentModel = selectedDSSModel; 
                this.theFormSchema = JSON.parse(this.currentModel.execution.input_schema); 
                this.theFormSchema.properties.weatherData = false; // Needs rewriting!
                //this.theFormSchema.properties.weatherData = this.weatherDataSchema; // This needs rewriting
                // Inspect the form schema. Does it refer to the field observation schema? In that case, add it to the 
                // schema node
                this.checkForFieldObservationSchema(this.theFormSchema);
                this.currentModelVisible = true;
                renderNamesFromEPPOCodes(this.currentModel);
            },
            checkForFieldObservationSchema(schemaNode){
                for(var key in schemaNode)
                {
                    if(key == "$ref" && schemaNode[key] == fieldObservationsSchemaRef)
                    {
                        // We have to postpone the assigment due to JavaScript's
                        // rules for pass-by-reference/value
                        // See: https://stackoverflow.com/questions/13104494/does-javascript-pass-by-reference 
                        return true;
                    }
                    if(typeof schemaNode[key] === "object")
                    {
                        if(this.checkForFieldObservationSchema(schemaNode[key]))
                        {
                            schemaNode[key] = this.fieldObservationSchema;
                        }
                    }
                }
                return false;
            },
            handleWeatherDataSourceSelect(selectedDataSource){
                this.currentDataSource = selectedDataSource;
                
                var dataSourceSpatialInfoTmp = JSON.parse(this.currentDataSource.spatial);
                // Sort stations alphabetically
                if(this.currentDataSource.access_type=='stations')
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
                var interval= this.currentModel.input.weather[0].interval; // TODO get from model
                var parameters = [];
                for(var i=0;i<this.currentModel.input.weather.length;i++)
                {
                    parameters.push(this.currentModel.input.weather[i].parameter_code);
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
                    return fetch(this.currentModel.execution.endpoint, {
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
                this.weatherDataSourceList = json.datasources;
            });
            fetch(WeatherServiceHost + "/rest/schema/weatherdata")
            .then(response => response.json())
            .then(json=>{
                this.weatherDataSchema = json
            });
            fetch(DSSServiceHost + "/rest/schema/fieldobservation")
            .then(response => response.json())
            .then(json=>{
                this.fieldObservationSchema = json
            });
            fetch(WeatherServiceHost + "/rest/parameter/list")
            .then(response => response.json())
            .then(json=>{
                //console.info(json);
                for(var i in json)
                {
                    var param = json[i];
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
 * 
 * @param {Object} DSSModel
 * @returns {undefined}
 */
var renderNamesFromEPPOCodes = function(DSSModel)
{
    var EPPOCodes = DSSModel.pests.concat(DSSModel.crops)
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
        for(var i=0;i<DSSModel.crops.length;i++)
        {
            cropItems.push("<a href=\"" + EPPO_TAXON_WEB_ENDPOINT  + DSSModel.crops[i]+ "\" target=\"new\">" + getEPPOName(retVal[DSSModel.crops[i]],LANGUAGE) + "</a>");
        }
        html += cropItems.join(", ");
        
        html +="</p><p><strong>Pests: </strong>";
        var pestItems = [];
        for(var i=0;i<DSSModel.pests.length;i++)
        {
            pestItems.push("<a href=\"" + EPPO_TAXON_WEB_ENDPOINT + DSSModel.pests[i]+ "\" target=\"new\">" + getEPPOName(retVal[DSSModel.pests[i]],LANGUAGE) + "</a>");
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

