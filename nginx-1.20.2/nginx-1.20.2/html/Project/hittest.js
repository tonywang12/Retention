/*	
 *	jQuery hitTest plugin
 *	Demo and documentation:
 *	http://e-smartdev.com/#!jsPluginList/hittestJQuery
 *	
 *	Original code copyright (c) 2012 Damien Corzani
 *	Updated by John Cook 2018-05-30:
 *		- retina displays considered
 *		- rectangles better defined (touching rectangles do not "hit"), eg:
 *		- rect (0, 0, 2, 2) contains point (0, 0) but not point (2, 2)
 *		- tweaks for faster execution (better use of javascript, less jQuery, avoid recalculations)
 *
 *	Dual licensed under the MIT and GPL licenses.
 *	http://en.wikipedia.org/wiki/MIT_License
 *	http://en.wikipedia.org/wiki/GNU_General_Public_License
 */

(function($) {

	// --------------------------------------------------------------------------------
	
	
	/**
	  * get the visible rect containing the jquery element
	  * return a rectangle object => ({x,y,width,height}) properties
	  */
	$.fn.getRect = function() {
		var offset = this.offset();
		if (!offset)
			return null;
		var formX = offset.left;
		var formY = offset.top;
		return new Rectangle(formX, formY, this.outerWidth(), this.outerHeight());
	};
	
	// --------------------------------------------------------------------------------
	
	/**
	  * test if a jquery element hittest with a given coodinate
	  * @param {Object} options = {
	  * 	'x': Xcoordinate to test
	  *		'y': Ycoordinate to test
	  *		'transparency' : manage images and canvas elements transparency
	  * }
	  */
	  
	$.fn.hitTestPoint = function(options) {
		// Add default options and store in 'settings'
		var settings = $.extend({
			'x' : 0,
			'y' : 0,
			'transparency' : false
		}, options);
		
		var objectRect = this.getRect();
		
		// if the rectangle doesn't contain the point, return false
		var pointInRect = objectRect.rectContainsPoint(settings.x, settings.y);
		if (!pointInRect)
			return false;
		
		var elementTarget = this[0];
		var jQueryTarget = $(elementTarget);
		
		// transparency is only supported for <img> and <canvas> elements. 
		if (settings.transparency && (jQueryTarget.is("img") || jQueryTarget.is("canvas"))) {
			
			var canvas = getCanvasFromElement(elementTarget);
			if (canvas == null) // the browser is not compatible with canvas element
				return true;
			
			// obtain a 1x1 point area. For retina screens this might be a 2x2 array (4 pixels)
			// That's okay as we're only testing the first (top-left) pixel element alpha component anyway
			var ctx = canvas.getContext('2d');
			var imageData = ctx.getImageData(settings.x - objectRect.x, settings.y - objectRect.y, 1, 1);
			pointInRect = (imageData.data[3] != 0);
		}
		return pointInRect;
	};
	
	// --------------------------------------------------------------------------------
	
	/**
	  * test if a jquery element hittest with a given coodinate
	  * @param {Object} options = {
	  *		'object': a single jQuery object to hittest against
	  *		'transparency' : manage images and canvas elements transparency
	  * }
	  */
	
	$.fn.objectHitTest = function(options) {
		// providing an object is not optional:
		if (options.object == null) //  the object to test is not set
			return false;
		
		// Add default options and store in 'settings'
		var settings = $.extend({
			'transparency' : false
		}, options);
		
		var objectRect = this.getRect();
		var objectToTestRect = settings.object.getRect();
		var rectsIntersect = objectRect.intersects(objectToTestRect);
		// if the rectangles don't intersect, return false
		if (!rectsIntersect)
			return false;
		
		var elementTarget = this[0];
		var jQueryTarget = $(elementTarget);
		
		// transparency is only supported for <img> and <canvas> elements. 
		if (settings.transparency && (jQueryTarget.is("img") || jQueryTarget.is("canvas"))) {
			
			var objectCanvas = getCanvasFromElement(elementTarget);
			var objectToTestCanvas = getCanvasFromElement(settings.object[0]);
			
			// if the browser is compatible with canvas element...
			if (objectCanvas != null && objectToTestCanvas != null) {
				
				var ctxObject = objectCanvas.getContext('2d');
				var ctxObjectToTest = objectToTestCanvas.getContext('2d');
				var intersectionRect = objectRect.intersection(objectToTestRect);
				
				// we've already tested that the rects intersect, but just in case we test for 'null' anyway
				if (intersectionRect == null) {
					console.log('HitTest: Program error: objects intersect but the intersection is empty');
					return true;			// ie. base it just on the rectangles
				}
				
				// get the intersectionRect bitmap of the 2 objects to test, forced to be a minimum size of 1x1
				// This works for retina displays also, although it introduces a possible error of 0.5 points
				var intersectionWidth = intersectionRect.width > 1 ? intersectionRect.width : 1;		// forced to minimum of 1 pixel
				var intersectionHeight = intersectionRect.height > 1 ? intersectionRect.height : 1;		// 	"
				var objectImageData = ctxObject.getImageData(intersectionRect.x - objectRect.x, intersectionRect.y - objectRect.y, intersectionWidth, intersectionHeight );
				var objectToTestImageData = ctxObjectToTest.getImageData(intersectionRect.x - objectToTestRect.x, intersectionRect.y - objectToTestRect.y, intersectionWidth, intersectionHeight );
				
				var objectPix = objectImageData.data;
				var objectToTestPix = objectToTestImageData.data;
				
				// if one pixel is not transparent in both objects at the same location, then we have a collision
				for (var i=0; i < objectImageData.data.length; i+=4) {
					if (objectPix[i+3] != 0 && objectToTestPix[i+3] != 0)		// note: +3 offsets to the alpha component (RGBA)
						return true;
				}
				return false;
			}
		}
		// if we fall through we simply return the intersection of the bounding rectangles
		return rectsIntersect;
	};
	
	// --------------------------------------------------------------------------------
	
	/**
	  * return a canvas of an image or a canvas element
	  * if the given element is not a canvas or an image return null
	  */
	
	function getCanvasFromElement(element) {
		// return the canvas of an element. Only <img> and <canvas> elements are supported. 
		// So if it's a canvas return 'element', if it's an image draw it into a new canvas, else return 'null'. 
		
		if (element.tagName.toLowerCase() == 'canvas')
			return element;
		
		if (element.tagName.toLowerCase() == 'img') {
		
			var canvas = document.createElement('canvas');
			if (! canvas.getContext)	// the browser is not compatible with canvas element (because method 'getContext' is not available)
				return null;
			
			var jElement = $(element);
			var outerWidth = jElement.outerWidth();
			var outerHeight = jElement.outerHeight();
			canvas.setAttribute('width', outerWidth);
			canvas.setAttribute('height', outerHeight);
			var ctx = canvas.getContext('2d');
			ctx.drawImage(element, 0, 0, outerWidth, outerHeight);
			return canvas;
		}
		// neither a <canvas> or an <img>
		return null;
	}

})( jQuery );

// --------------------------------------------------------------------------------


/**
 * Rectangle Class
 */

function Rectangle(x, y, width, height) {
	this.x = x;
	this.y = y;
	this.width = width;
	this.height = height;
	
	// return rectangle information as a string
	this.toString = function() {
		return '(x=' + this.x + ', y=' + this.y + ', width=' + this.width +', height=' +this.height+')';
	};
	
	// check if a rectangle contains a point. Note: a rectangle (0, 0, 2, 2) does not contain the point (2, 2)!
	this.rectContainsPoint = function (pointX, pointY) {
		return (pointX >= this.x && pointX < this.x + this.width && pointY >= this.y && pointY < this.y + this.height);	
	}
	
	// check if two rectangles intersect. Two touching rectangles do NOT intersect, so (0, 0, 2, 2) does not intersect (2, 0, 2, 2)
	this.intersects = function(rect) {
		return (this.x < rect.x + rect.width && rect.x < this.x + this.width && this.y < rect.y + rect.height && rect.y < this.y + this.height);
	}
	
	// return the intersection of two rectangles, or null if they don't intersect
	this.intersection = function(rect) {
		var largerLeft = Math.max(this.x, rect.x);					// ie. highest X just beyond the rectangle
		var smallerRight = Math.min(this.x + this.width, rect.x + rect.width);
		
		// if overlap horizontally:
		if (largerLeft < smallerRight) {
			// remember y is downwards -- from the top
			var lowerTop = Math.max(this.y, rect.y);							// lower on the page (larger numerically)
			var higherBottom = Math.min(this.y + this.height, rect.y + rect.height);		// higher on the page (smaller numerically)
			
			// if overlap vertically:
			if (lowerTop < higherBottom) {
				return new Rectangle(largerLeft, lowerTop, smallerRight - largerLeft, higherBottom - lowerTop);
			}
		}
		return null;
	}
}
