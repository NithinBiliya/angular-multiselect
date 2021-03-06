// Source: https://github.com/amitava82/angular-multiselect

angular.module('am.multiselect', [])

// from bootstrap-ui typeahead parser
.factory('optionParser', ['$parse', function ($parse) {
    // 00000111000000000000022200000000000000003333333333333330000000000044000
    var TYPEAHEAD_REGEXP = /^\s*([\s\S]+?)(?:\s+as\s+([\s\S]+?))?\s+for\s+(?:([\$\w][\$\w\d]*))\s+in\s+([\s\S]+?)$/;
    return {
        parse:function (input) {
            var match = input.match(TYPEAHEAD_REGEXP);
            if (!match) {
                throw new Error(
                    'Expected typeahead specification in form of "_modelValue_ (as _label_)? for _item_ in _collection_"' +
                    ' but got "' + input + '".');
            }
            return {
                itemName:match[3],
                source:$parse(match[4]),
                viewMapper:$parse(match[2] || match[1]),
                modelMapper:$parse(match[1])
            };
        }
    };
}])

.directive('amMultiselect', ['$parse', '$document', '$compile', '$interpolate', '$filter', 'optionParser',

    function ($parse, $document, $compile, $interpolate, $filter, optionParser) {
    return {
        restrict: 'E',
        require: 'ngModel',
        link: function (originalScope, element, attrs, modelCtrl) {
        // Redefine isEmpty - this allows this to work on at least Angular 1.2.x
        var isEmpty = modelCtrl.$isEmpty;
        modelCtrl.$isEmpty = function(value) {
            return isEmpty(value) || (angular.isArray(value) && value.length == 0);
        };

        var exp = attrs.options,
        parsedResult = optionParser.parse(exp),
        isMultiple = attrs.multiple ? true : false,
		isHover = attrs.hover ? true : false,
        required = false,
        scope = originalScope.$new(),
        changeHandler = attrs.change || angular.noop;

        scope.items = [];
        scope.header = 'Select';
        scope.multiple = isMultiple;
        scope.disabled = false;
        scope.searchDisable = false;
        scope.onBlur = attrs.ngBlur || angular.noop;
		scope.hoverText = isHover ? scope.header : '';
        scope.onFocus = attrs.ngFocus;
        scope.clazz = attrs.clazz;

        originalScope.$on('$destroy', function () {
            scope.$destroy();
        });

        var popUpEl = angular.element('<am-multiselect-popup' +
            (attrs.templateUrl ? (' template-url="' + attrs.templateUrl + '"'): '' ) +
            '></am-multiselect-popup>');

        // required validator
        if (attrs.required || attrs.ngRequired) {
            required = true;
        }
        attrs.$observe('required', function(newVal) {
            required = newVal;
        });

        // watch disabled state
        scope.$watch(function () {
            return $parse(attrs.ngDisabled)(originalScope);
        }, function (newVal) {
            scope.disabled = newVal;
        });

        // watch disabled state for search text box
        scope.$watch(function () {
            return $parse(attrs.searchDisable)(originalScope);
        }, function (newVal) {
            scope.searchDisable = newVal;
        });

        // watch single/multiple state for dynamically change single to multiple
        scope.$watch(function () {
            return $parse(attrs.multiple)(originalScope);
        }, function (newVal) {
            isMultiple = newVal || false;
        });

        // watch option changes for options that are populated dynamically
        scope.$watch(function () {
            return parsedResult.source(originalScope);
        }, function (newVal) {
        if (angular.isDefined(newVal))
            parseModel();
        }, true);

        // watch model change
        scope.$watch(function () {
            return modelCtrl.$modelValue;
        }, function (newVal) {
        // When the model is assigned a "" or undefined value from controller, need to uncheck all items and clear searchText.label
            if(angular.isUndefined(newVal) || newVal==="" || newVal===null) {
              scope.uncheckAll();
              if(angular.isDefined(scope.searchText))
                scope.searchText.label="";
            }
        // when directive initialize, newVal usually undefined. Also, if model value already set in the controller
        // for preselected list then we need to mark checked in our scope item. But we don't want to do this every time
        // model changes. We need to do this only if it is done outside directive scope, from controller, for example.
            else if (angular.isDefined(newVal)) {
                markChecked(newVal);
                scope.$eval(changeHandler);
            }
            getHeaderText();
			scope.hoverText = isHover ? scope.header : '';
            modelCtrl.$setValidity('required', scope.valid());
        }, true);

        function parseModel() {
            scope.items.length = 0;
            var model = parsedResult.source(originalScope);
            if(angular.isUndefined(model)) return;
            for (var i = 0; i < model.length; i++) {
                var local = {};
                local[parsedResult.itemName] = model[i];
                scope.items.push({
                    label: parsedResult.viewMapper(local),
                    model: parsedResult.modelMapper(local),
                    checked: false
                });
            }
        }

        parseModel();

        element.append($compile(popUpEl)(scope));

		function getItemLabel(items,model) {
          for(var i = 0; i < items.length; i++) {
            if(items[i].model==model) {
              return items[i].label;
            }
          }
        }

        function getHeaderText() {
            if (is_empty(modelCtrl.$modelValue)) return scope.header = (angular.isDefined(attrs.msHeader) ? attrs.msHeader : 'Select');

            if (isMultiple) {
                if (attrs.msSelected) {
                    scope.header = $interpolate(attrs.msSelected)(scope);
                } else {
                    if (modelCtrl.$modelValue.length == 1) {
                        for(var i = 0; i < scope.items.length; i++) {
                            if(scope.items[i].model === modelCtrl.$modelValue[0]) {
                            scope.header = scope.items[i].label;
                            }
                        }
                    } else {
                    scope.header = modelCtrl.$modelValue.length + ' ' + 'selected';
                    }
                }
            } else {
                if(angular.isString(modelCtrl.$modelValue)){
                    scope.header = getItemLabel(scope.items,modelCtrl.$modelValue);
                } else {
                    var local = {};
                    local[parsedResult.itemName] = modelCtrl.$modelValue;
                    scope.header = parsedResult.viewMapper(local) || getItemLabel(scope.items,modelCtrl.$modelValue);
                }
            }
        }

        function is_empty(obj) {
            if (angular.isNumber(obj)) return false;
            if (obj && obj.length && obj.length > 0) return false;
            for (var prop in obj) if (obj[prop]) return false;
                return true;
        }

        scope.valid = function validModel() {
            if(!required) return true;
            var value = modelCtrl.$modelValue;
            return (angular.isArray(value) && value.length > 0) || (!angular.isArray(value) && value != null);
        };

        function selectSingle(item) {
            if (item.checked) {
                scope.uncheckAll();
            } else {
                scope.uncheckAll();
                item.checked = !item.checked;
            }
            setModelValue(false);
        }

        function selectMultiple(item) {
            item.checked = !item.checked;
            setModelValue(true);
        }

        function setModelValue(isMultiple) {
            var value = undefined;

            if (isMultiple) {
                value = [];
                angular.forEach(scope.items, function (item) {
                    if (item.checked) value.push(item.model);
                })
                if(value.length==0) value=undefined;
            } else {
                angular.forEach(scope.items, function (item) {
                    if (item.checked) {
                        value = item.model;
                        return false;
                    }
                })
            }
            modelCtrl.$setViewValue(value);
        }

        function markChecked(newVal) {
            if (!angular.isArray(newVal)) {
                angular.forEach(scope.items, function (item) {
                    if (angular.equals(item.model, newVal)) {
                        scope.uncheckAll();
                        item.checked = true;
                        setModelValue(false);
                        return false;
                    }
                });
            } else {
                angular.forEach(scope.items, function (item) {
                    item.checked = false;
                    angular.forEach(newVal, function (i) {
                        if (angular.equals(item.model, i)) {
                            item.checked = true;
                        }
                    });
                });
            }
        }

        scope.checkAll = function () {
            if (!isMultiple) return;
            var items = (scope.searchText && scope.searchText.label.length > 0) ? $filter('filter')(scope.items, scope.searchText) : scope.items;
            angular.forEach(items, function (item) {
                item.checked = true;
            });
            setModelValue(true);
        };

        scope.uncheckAll = function () {
			// need to uncheck from the entire list of items. If user filers with ine text and selects item A. Next time user fileters and selects item B (item A now not in the filtered set). The item A will not get unchecked
            // var items = (scope.searchText && scope.searchText.label.length > 0) ? $filter('filter')(scope.items, scope.searchText) : scope.items;
            angular.forEach(scope.items, function (item) {
                item.checked = false;
            });
			// sending scope.multiple instead of true to setModelValue. Since different values geeting set when single and multiple.
            setModelValue(scope.multiple);
        };

        scope.select = function (item) {
            if (isMultiple === false) {
                selectSingle(item);
                scope.toggleSelect();
            } else {
                selectMultiple(item);
            }
        }
        }
    };
}])

.directive('amMultiselectPopup', ['$document', '$filter', function ($document, $filter) {
    return {
        restrict: 'E',
        scope: false,
        replace: true,
        templateUrl: 'html/multiselect.tmpl.html',
        link: function (scope, element) {

            scope.selectedIndex = null;
            scope.isVisible = false;
            scope.filteredItems = null;

            scope.ngClazz = {
                'error': !scope.valid()
            };
            scope.ngClazz[scope.$eval(scope.clazz)] = true;

            scope.toggleSelect = function () {
                if (element.hasClass('open')) {
                    element.removeClass('open');
                    $document.unbind('click', clickHandler);
                    scope.$parent.$eval(scope.onBlur);
                } else {
                    element.addClass('open');
                    $document.bind('click', clickHandler);
                    scope.focus();
                }
            };

            scope.evalFocus = function() {
              scope.$parent.$eval(scope.onFocus);
            }

            function clickHandler(event) {
                if (elementMatchesAnyInArray(event.target, element.find(event.target.tagName))) {
                    scope.$parent.$eval(scope.onBlur);
                } else {
                    element.removeClass('open');
                    $document.unbind('click', clickHandler);
                    scope.$apply();
                }
            }

            scope.focus = function focus(){
                var searchBox = element.find('input')[0];
                if (searchBox) {
                    searchBox.focus();
                }
            }

            scope.keydown = function (event) {
                var list = $filter('filter')(scope.items, scope.searchText);
                var keyCode = (event.keyCode || event.which);

                if(keyCode === 13){ // On enter
                    if(list[scope.selectedIndex]){
                        scope.select(list[scope.selectedIndex]); // (un)select item
                    }
                }else if(keyCode === 38){ // On arrow up
                    scope.selectedIndex = scope.selectedIndex===null ? list.length-1 : scope.selectedIndex-1;
                }else if(keyCode === 40){ // On arrow down
                    scope.selectedIndex = scope.selectedIndex===null ? 0 : scope.selectedIndex+1;
                }else{ // On any other key
                    scope.selectedIndex = null;
                }

                if(scope.selectedIndex < 0){ // Select last in list
                    scope.selectedIndex = list.length-1;
                }else if(scope.selectedIndex > list.length-1){ // Set selection to first item in list
                    scope.selectedIndex = 0;
                }
            };

            var elementMatchesAnyInArray = function (element, elementArray) {
                for (var i = 0; i < elementArray.length; i++)
                    if (element == elementArray[i])
                        return true;
                return false;
            }
        }
    }
}]);
