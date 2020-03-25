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

/**
 * 
 * @param {type} url
 * @param {type} callback
 * @param {dictionary} parameters - If you need to keep parameter state and transfer to callback execution. E.g. {foo:"Bar"} can be retrieved by this.parameters.foo
 * @returns {undefined}General XMLHttpRequest utility function. To avoid using JQuery or similarly
 * bloated framework
 */
var ajax = function(url, callback, parameters)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.onload = callback;
    xhr.parameters = parameters;
    xhr.send();
};


