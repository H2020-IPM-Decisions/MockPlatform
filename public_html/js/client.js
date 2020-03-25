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
    var app = new Vue({
        el:"#app",
        data: {
            DSSList : [],
            currentModel : {},
            currentModelVisible : false
        },
        methods: {
            renderNamesFromEPPOCodes:renderNamesFromEPPOCodes
        },
        created(){
            fetch(DSSServiceHost + "/rest/list")
            .then(response => response.json())
            .then(json=>{
                console.info(json);
                this.DSSList = json;
            })
        }
    });
}


var weatherDataSources; // Keeping datasources in memory

/**
 * Fetches weather datasource info from backend
 * @returns void
 */
var getWeatherDataSources = function(){
    ajax(WeatherServiceHost + "/rest/weatherdatasource/list", function(e){
        weatherDataSources = JSON.parse(e.target.responseText);
        console.info(weatherDataSources);
    });
};


var EPPORestAPIURL = "https://data.eppo.int/api/rest/1.0/";

/**
 * 
 * @param {String[]} EPPOCodes
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
        //console.info(retVal);
    });
    
    
};

var getEPPOName = function(nameInfo, language)
{
    console.info(nameInfo);
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

