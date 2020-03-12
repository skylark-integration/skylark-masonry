define([
    "skylark-langx/skylark",
    "skylark-jquery"
], function (skylark,jQuery) {

    'use strict';

    var console = window.console;
    var noop = function() {};
    var instances = {};

    // -------------------------- masonryDefinition -------------------------- //

    // create an Outlayer layout class
    //var Masonry = Outlayer.create('masonry');

    /**
     * @param {Element, String} element
     * @param {Object} options
     * @constructor
     */
    function Masonry(element, options) {
        var queryElement = getQueryElement(element);
        if (!queryElement) {
            if (console) {
                console.error('Bad element for ' + this.constructor.namespace +
                    ': ' + (queryElement || element));
            }
            return;
        }
        this.element = queryElement;
        // add jQuery
        if (jQuery) {
            this.$element = jQuery(this.element);
        }

        // options
        this.options = jQuery.extend({}, this.constructor.defaults);
        this.option(options);

        // add id for Outlayer.getFromElement
        var id = ++GUID;
        this.$element.data("outlayerGUID", id); // expando
        instances[id] = this; // associate via id

        // kick it off
        this._create();

        var isInitLayout = this._getOption('initLayout');
        if (isInitLayout) {
            this.layout();
        }
    }

    // settings are for internal use only
    Masonry.namespace = 'masonry';
    Masonry.Item = function(elem, layout) {
        this.element = elem;
        this.layout = layout;
        this.position = {
            x: 0,
            y: 0
        };
    };
    Masonry.Item.prototype.getSize = function() {
        return this.size = {
            outerWidth: $(this.element).outerWidth(true),
            outerHeight: $(this.element).outerHeight(true)
        };
    };
    Masonry.Item.prototype.goTo = function(x, y) {
        this.position.x = parseInt(x, 10);
        this.position.y = parseInt(y, 10);
        $(this.element).css({
            position: "absolute",
            left: this.position.x + "px",
            top: this.position.y + "px"
        });
    };
    Masonry.Item.prototype.moveTo = function(x, y) {
        //this.goTo(x,y);
        //$(this.element).slideInDown();
        $(this.element).css({
            position: "absolute",
        });
        $(this.element).moveto(x, y);
    };
    // default options
    Masonry.defaults = {
        containerStyle: {
            position: 'relative'
        },
        initLayout: true,
        originLeft: true,
        originTop: true,
        resize: true,
        resizeContainer: true,
        // item options
        transitionDuration: '0.4s',
        hiddenStyle: {
            opacity: 0,
            transform: 'scale(0.001)'
        },
        visibleStyle: {
            opacity: 1,
            transform: 'scale(1)'
        }
    };

    Masonry.compatOptions = {
        // currentName: oldName
        initLayout: 'isInitLayout',
        horizontal: 'isHorizontal',
        layoutInstant: 'isLayoutInstant',
        originLeft: 'isOriginLeft',
        originTop: 'isOriginTop',
        resize: 'isResizeBound',
        resizeContainer: 'isResizingContainer'
    };


    // isFitWidth -> fitWidth
    Masonry.compatOptions.fitWidth = 'isFitWidth';

    Masonry.prototype.getSize = function() {
        this.size = {
            width: $(this.element).width(),
            height: $(this.element).height()
        };
    };
    Masonry.prototype._resetLayout = function() {
        this.getSize();
        this._getMeasurement('columnWidth', 'outerWidth');
        this._getMeasurement('gutter', 'outerWidth');
        this.measureColumns();

        // reset column Y
        this.colYs = [];
        for (var i = 0; i < this.cols; i++) {
            this.colYs.push(0);
        }

        this.maxY = 0;
    };

    Masonry.prototype.measureColumns = function() {
        this.getContainerWidth();
        // if columnWidth is 0, default to outerWidth of first item
        if (!this.columnWidth) {
            var firstItem = this.items[0];
            var firstItemElem = firstItem && firstItem.element;
            // columnWidth fall back to item of first element
            this.columnWidth = firstItem && firstItem.getSize().outerWidth ||
                // if first elem has no width, default to size of container
                this.containerWidth;
        }

        var columnWidth = this.columnWidth += this.gutter;

        // calculate columns
        var containerWidth = this.containerWidth + this.gutter;
        var cols = containerWidth / columnWidth;
        // fix rounding errors, typically with gutters
        var excess = columnWidth - containerWidth % columnWidth;
        // if overshoot is less than a pixel, round up, otherwise floor it
        var mathMethod = excess && excess < 1 ? 'round' : 'floor';
        cols = Math[mathMethod](cols);
        this.cols = Math.max(cols, 1);
    };

    Masonry.prototype.getContainerWidth = function() {
        // container is parent if fit width
        var isFitWidth = this._getOption('fitWidth');
        var container = isFitWidth ? this.element.parentNode : this.element;
        // check that this.size and size are there
        // IE8 triggers resize on body size change, so they might not be
        //var size = getSize( container );
        //this.containerWidth = size && size.innerWidth;
        this.containerWidth = $(container).width();
    };

    Masonry.prototype._getItemLayoutPosition = function(item) {
        item.getSize();
        // how many columns does this brick span
        var remainder = item.size.outerWidth % this.columnWidth;
        var mathMethod = remainder && remainder < 1 ? 'round' : 'ceil';
        // round if off by 1 pixel, otherwise use ceil
        var colSpan = Math[mathMethod](item.size.outerWidth / this.columnWidth);
        colSpan = Math.min(colSpan, this.cols);

        var colGroup = this._getColGroup(colSpan);
        // get the minimum Y value from the columns
        var minimumY = Math.min.apply(Math, colGroup);
        var shortColIndex = colGroup.indexOf(minimumY);

        // position the brick
        var position = {
            x: this.columnWidth * shortColIndex,
            y: minimumY
        };

        // apply setHeight to necessary columns
        var setHeight = minimumY + item.size.outerHeight;
        var setSpan = this.cols + 1 - colGroup.length;
        for (var i = 0; i < setSpan; i++) {
            this.colYs[shortColIndex + i] = setHeight;
        }

        return position;
    };

    /**
     * @param {Number} colSpan - number of columns the element spans
     * @returns {Array} colGroup
     */
    Masonry.prototype._getColGroup = function(colSpan) {
        if (colSpan < 2) {
            // if brick spans only one column, use all the column Ys
            return this.colYs;
        }

        var colGroup = [];
        // how many different places could this brick fit horizontally
        var groupCount = this.cols + 1 - colSpan;
        // for each group potential horizontal position
        for (var i = 0; i < groupCount; i++) {
            // make an array of colY values for that one group
            var groupColYs = this.colYs.slice(i, i + colSpan);
            // and get the max value of the array
            colGroup[i] = Math.max.apply(Math, groupColYs);
        }
        return colGroup;
    };

    Masonry.prototype._manageStamp = function(stamp) {
        var stampSize = getSize(stamp);
        var offset = this._getElementOffset(stamp);
        // get the columns that this stamp affects
        var isOriginLeft = this._getOption('originLeft');
        var firstX = isOriginLeft ? offset.left : offset.right;
        var lastX = firstX + stampSize.outerWidth;
        var firstCol = Math.floor(firstX / this.columnWidth);
        firstCol = Math.max(0, firstCol);
        var lastCol = Math.floor(lastX / this.columnWidth);
        // lastCol should not go over if multiple of columnWidth #425
        lastCol -= lastX % this.columnWidth ? 0 : 1;
        lastCol = Math.min(this.cols - 1, lastCol);
        // set colYs to bottom of the stamp

        var isOriginTop = this._getOption('originTop');
        var stampMaxY = (isOriginTop ? offset.top : offset.bottom) +
            stampSize.outerHeight;
        for (var i = firstCol; i <= lastCol; i++) {
            this.colYs[i] = Math.max(stampMaxY, this.colYs[i]);
        }
    };

    Masonry.prototype._getContainerSize = function() {
        this.maxY = Math.max.apply(Math, this.colYs);
        var size = {
            height: this.maxY
        };

        if (this._getOption('fitWidth')) {
            size.width = this._getContainerFitWidth();
        }

        return size;
    };

    Masonry.prototype._getContainerFitWidth = function() {
        var unusedCols = 0;
        // count unused columns
        var i = this.cols;
        while (--i) {
            if (this.colYs[i] !== 0) {
                break;
            }
            unusedCols++;
        }
        // fit container to columns that have been used
        return (this.cols - unusedCols) * this.columnWidth - this.gutter;
    };

    Masonry.prototype.needsResizeLayout = function() {
        var previousWidth = this.containerWidth;
        this.getContainerWidth();
        return previousWidth != this.containerWidth;
    };


    //---copy from outlayer
    var proto = Masonry.prototype;

    // globally unique identifiers
    var GUID = 0;

    // use element as selector string
    var getQueryElement = function(elem) {
        if (typeof elem == 'string') {
            return document.querySelector(elem);
        }
        return elem;
    };
    // turn element or nodeList into an array
    var makeArray = function(obj) {
        var ary = [];
        if (Array.isArray(obj)) {
            // use object if already an array
            ary = obj;
        } else if (obj && typeof obj.length == 'number') {
            // convert nodeList to array
            for (var i = 0; i < obj.length; i++) {
                ary.push(obj[i]);
            }
        } else {
            // array of single index
            ary.push(obj);
        }
        return ary;
    };
    var indexOf = Array.prototype.indexOf ? function(ary, obj) {
        return ary.indexOf(obj);
    } : function(ary, obj) {
        for (var i = 0, len = ary.length; i < len; i++) {
            if (ary[i] === obj) {
                return i;
            }
        }
        return -1;
    };

    var removeFrom = function(ary, obj) {
        var index = indexOf(ary, obj);
        if (index != -1) {
            ary.splice(index, 1);
        }
    };

    var filterFindElements = function(elems, selector) {
        // make array of elems
        elems = makeArray(elems);
        var ffElems = [];

        elems.forEach(function(elem) {
            // check that elem is an actual element
            if (!(elem instanceof HTMLElement)) {
                return;
            }
            // add elem if no selector
            if (!selector) {
                ffElems.push(elem);
                return;
            }
            // filter & find items if we have a selector
            // filter
            //if ( matchesSelector( elem, selector ) ) {
            if (jQuery(elem).is(selector)) {
                ffElems.push(elem);
            }
            // find children
            var childElems = elem.querySelectorAll(selector);
            // concat childElems to filterFound array
            for (var i = 0; i < childElems.length; i++) {
                ffElems.push(childElems[i]);
            }
        });

        return ffElems;
    };

    /**
     * set options
     * @param {Object} opts
     */
    proto.option = function(opts) {
        jQuery.extend(this.options, opts);
    };

    /**
     * get backwards compatible option value, check old name
     */
    proto._getOption = function(option) {
        var oldOption = this.constructor.compatOptions[option];
        return oldOption && this.options[oldOption] !== undefined ?
            this.options[oldOption] : this.options[option];
    };

    proto._create = function() {
        // get items from children
        this.reloadItems();
        // elements that affect layout, but are not laid out
        //this.stamps = [];
        //this.stamp( this.options.stamp );
        // set container style
        jQuery.extend(this.element.style, this.options.containerStyle);

        // bind resize method
        //var canBindResize = this._getOption('resize');
        //if ( canBindResize ) {
        //  this.bindResize();
        //}
    };

    // goes through all children again and gets bricks in proper order
    proto.reloadItems = function() {
        // collection of item elements
        this.items = this._itemize(this.element.children);
    };


    /**
     * turn elements into Outlayer.Items to be used in layout
     * @param {Array or NodeList or HTMLElement} elems
     * @returns {Array} items - collection of new Outlayer Items
     */
    proto._itemize = function(elems) {

        var itemElems = this._filterFindItemElements(elems);
        var Item = this.constructor.Item;

        // create new Outlayer Items for collection
        var items = [];
        for (var i = 0; i < itemElems.length; i++) {
            var elem = itemElems[i];
            var item = new Item(elem, this);
            items.push(item);
        }

        return items;
    };

    /**
     * get item elements to be used in layout
     * @param {Array or NodeList or HTMLElement} elems
     * @returns {Array} items - item elements
     */
    proto._filterFindItemElements = function(elems) {
        //return utils.filterFindElements( elems, this.options.itemSelector );
        //return jQuery(elems).filter(this.options.itemSelector );
        return filterFindElements(elems, this.options.itemSelector);
    };



    /**
     * lays out all items
     */
    proto.layout = function() {
        this._resetLayout();
        //this._manageStamps();

        // don't animate first layout
        var layoutInstant = this._getOption('layoutInstant');
        var isInstant = layoutInstant !== undefined ?
            layoutInstant : !this._isLayoutInited;
        this.layoutItems(this.items, isInstant);

        // flag for initalized
        this._isLayoutInited = true;
    };

    /**
     * get measurement from option, for columnWidth, rowHeight, gutter
     * if option is String -> get element from selector string, & get size of element
     * if option is Element -> get size of element
     * else use option as a number
     *
     * @param {String} measurement
     * @param {String} size - width or height
     * @private
     */
    proto._getMeasurement = function(measurement, size) {
        var option = this.options[measurement];
        var elem;
        if (!option) {
            // default to 0
            this[measurement] = 0;
        } else {
            // use option as an element
            if (typeof option == 'string') {
                elem = this.element.querySelector(option);
            } else if (option instanceof HTMLElement) {
                elem = option;
            }
            // use size of element, if element
            //this[ measurement ] = elem ? getSize( elem )[ size ] : option;
            this[measurement] = elem ? $(elem)[size]() : option;
        }
    };

    /**
     * layout a collection of item elements
     * @api public
     */
    proto.layoutItems = function(items, isInstant) {
        items = this._getItemsForLayout(items);

        this._layoutItems(items, isInstant);

        this._postLayout();
    };

    /**
     * get the items to be laid out
     * you may want to skip over some items
     * @param {Array} items
     * @returns {Array} items
     */
    proto._getItemsForLayout = function(items) {
        return items.filter(function(item) {
            return !item.isIgnored;
        });
    };

    /**
     * layout items
     * @param {Array} items
     * @param {Boolean} isInstant
     */
    proto._layoutItems = function(items, isInstant) {
        // this._emitCompleteOnItems( 'layout', items );

        if (!items || !items.length) {
            // no items, emit event with empty array
            return;
        }

        var queue = [];

        items.forEach(function(item) {
            // get x/y object from method
            var position = this._getItemLayoutPosition(item);
            // enqueue
            position.item = item;
            position.isInstant = isInstant || item.isLayoutInstant;
            queue.push(position);
        }, this);

        this._processLayoutQueue(queue);
    };

    /**
     * iterate over array and position each item
     * Reason being - separating this logic prevents 'layout invalidation'
     * thx @paul_irish
     * @param {Array} queue
     */
    proto._processLayoutQueue = function(queue) {
        queue.forEach(function(obj) {
            this._positionItem(obj.item, obj.x, obj.y, obj.isInstant);
        }, this);
    };

    /**
     * Sets position of item in DOM
     * @param {Outlayer.Item} item
     * @param {Number} x - horizontal position
     * @param {Number} y - vertical position
     * @param {Boolean} isInstant - disables transitions
     */
    proto._positionItem = function(item, x, y, isInstant) {
        if (isInstant) {
            // if not transition, just set CSS
            item.goTo(x, y);
        } else {
            item.moveTo(x, y);
        }
    };

    /**
     * Any logic you want to do after each layout,
     * i.e. size the container
     */
    proto._postLayout = function() {
        this.resizeContainer();
    };

    proto.resizeContainer = function() {
        var isResizingContainer = this._getOption('resizeContainer');
        if (!isResizingContainer) {
            return;
        }
        var size = this._getContainerSize();
        if (size) {
            this._setContainerMeasure(size.width, true);
            this._setContainerMeasure(size.height, false);
        }
    };

    /**
     * @param {Number} measure - size of width or height
     * @param {Boolean} isWidth
     */
    proto._setContainerMeasure = function(measure, isWidth) {
        if (measure === undefined) {
            return;
        }

        var elemSize = this.size;
        // add padding and border width if border box
        if (elemSize.isBorderBox) {
            measure += isWidth ? elemSize.paddingLeft + elemSize.paddingRight +
                elemSize.borderLeftWidth + elemSize.borderRightWidth :
                elemSize.paddingBottom + elemSize.paddingTop +
                elemSize.borderTopWidth + elemSize.borderBottomWidth;
        }

        measure = Math.max(measure, 0);
        this.element.style[isWidth ? 'width' : 'height'] = measure + 'px';
    };



    /**
     * add items to Outlayer instance
     * @param {Array or NodeList or Element} elems
     * @returns {Array} items - Outlayer.Items
     **/
    proto.addItems = function(elems) {
        var items = this._itemize(elems);
        // add items to collection
        if (items.length) {
            this.items = this.items.concat(items);
        }
        return items;
    };

    /**
     * Layout newly-appended item elements
     * @param {Array or NodeList or Element} elems
     */
    proto.appended = function(elems) {
        var items = this.addItems(elems);
        if (!items.length) {
            return;
        }
        // layout and reveal just the new items
        this.layoutItems(items, true);
        this.reveal(items);
    };

    /**
     * Layout prepended elements
     * @param {Array or NodeList or Element} elems
     */
    proto.prepended = function(elems) {
        var items = this._itemize(elems);
        if (!items.length) {
            return;
        }
        // add items to beginning of collection
        var previousItems = this.items.slice(0);
        this.items = items.concat(previousItems);
        // start new layout
        this._resetLayout();
        //this._manageStamps();
        // layout new stuff without transition
        this.layoutItems(items, true);
        this.reveal(items);
        // layout previous items
        this.layoutItems(previousItems);
    };

    /**
     * reveal a collection of items
     * @param {Array of Outlayer.Items} items
     */
    proto.reveal = function(items) {
        // this._emitCompleteOnItems( 'reveal', items );
        if (!items || !items.length) {
            return;
        }
        items.forEach(function(item) {
            //item.reveal();
        });
    };

    /**
     * hide a collection of items
     * @param {Array of Outlayer.Items} items
     */
    proto.hide = function(items) {
        // this._emitCompleteOnItems( 'hide', items );
        if (!items || !items.length) {
            return;
        }
        items.forEach(function(item) {
            item.hide();
        });
    };

    /**
     * reveal item elements
     * @param {Array}, {Element}, {NodeList} items
     */
    proto.revealItemElements = function(elems) {
        var items = this.getItems(elems);
        this.reveal(items);
    };

    /**
     * hide item elements
     * @param {Array}, {Element}, {NodeList} items
     */
    proto.hideItemElements = function(elems) {
        var items = this.getItems(elems);
        this.hide(items);
    };

    /**
     * get Outlayer.Item, given an Element
     * @param {Element} elem
     * @param {Function} callback
     * @returns {Outlayer.Item} item
     */
    proto.getItem = function(elem) {
        // loop through items to get the one that matches
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (item.element == elem) {
                // return item
                return item;
            }
        }
    };

    /**
     * get collection of Outlayer.Items, given Elements
     * @param {Array} elems
     * @returns {Array} items - Outlayer.Items
     */
    proto.getItems = function(elems) {
        elems = makeArray(elems);
        var items = [];
        elems.forEach(function(elem) {
            var item = this.getItem(elem);
            if (item) {
                items.push(item);
            }
        }, this);

        return items;
    };

    /**
     * remove element(s) from instance and DOM
     * @param {Array or NodeList or Element} elems
     */
    proto.remove = function(elems) {
        var removeItems = this.getItems(elems);

        // this._emitCompleteOnItems('remove', removeItems);

        // bail if no items to remove
        if (!removeItems || !removeItems.length) {
            return;
        }

        removeItems.forEach(function(item) {
            if(item.element) item.element.remove();
            // remove item from collection
            removeFrom(this.items, item);
        }, this);
    };

    return skylark.attach("intg.Masonry", Masonry);
});
