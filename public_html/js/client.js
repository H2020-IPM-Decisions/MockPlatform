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
            currentModel: {},
            currentModelVisible: false,
            theFormSchema: null,
            weatherDataSchema: null,
            formData: {}
        },
        methods: {
            renderNamesFromEPPOCodes:renderNamesFromEPPOCodes,
//            renderRunModelForm: renderRunModelForm,
            handleModelSelect(selectedDSSModel){
                this.currentModel = selectedDSSModel; 
                this.theFormSchema = JSON.parse(this.currentModel.How_to_run.Input_schema); 
                this.theFormSchema.properties.weatherData = this.weatherDataSchema;
                this.currentModelVisible = true;
                renderNamesFromEPPOCodes(this.currentModel);
            },
            displayData: function(){
                console.info(JSON.stringify(this.formData));
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
            fetch("https://ipmdecisions.nibio.no/WeatherService/rest/schema/weatherdata")
            .then(response => response.json())
            .then(json=>{
                this.weatherDataSchema = json
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

