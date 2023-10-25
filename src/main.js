window.calendar = (function(){

	/**
	 * Helper function to create an element with the the given attributes
	 * @param {string} tagname
	 * @param {object} name-value pairs to be set as attributes
	 * @returns {HTMLElement}
	 */
	function makeEle(name, attrs){
		var ele = document.createElement(name);
		for(var i in attrs)
			if(attrs.hasOwnProperty(i))
				ele.setAttribute(i, attrs[i]);
		return ele;
	}
	
	/**
	 * Remove an event handler from an element
	 * @param {HTMLElement} el - element with an event listener to remove
	 * @param {string} type - the type of event being handled (eg, click)
	 * @param {function} handler - the event handler to be removed
	 * @returns {undefined}
	 */
	function removeEventListener(el, type, handler) {
		if (el.detachEvent) el.detachEvent('on'+type, handler); 
		else el.removeEventListener(type, handler);
	}
	
	/**
	 * Attach an event handler to an element
	 * @param {HTMLElement} el - element to attach an event listener to
	 * @param {string} type - the type of event to listen for (eg, click)
	 * @param {function} handler - the event handler to be attached
	 * @returns {undefined}
	 */
	function addEventListener(el, type, handler) {
		if (el.attachEvent) el.attachEvent('on'+type, handler); 
		else el.addEventListener(type, handler);
	}
	
	class Calendar{
		
		constructor(elem, opts){
			opts = opts || {};
			
			this._eventGroups = [];
			this.selectedDates = [];
			this.elem = elem;
			this.disabledDates = (opts.disabledDates || []).map(d=>this.formatDateMMDDYY(d));
			this.abbrDay = opts.hasOwnProperty('abbrDay') ? opts.abbrDay : true;
			this.abbrMonth = opts.hasOwnProperty('abbrMonth') ? opts.abbrMonth : true;
			this.abbrYear = opts.hasOwnProperty('abbrYear') ? opts.abbrYear : true;
			this.onDayClick = opts.onDayClick || function(){};
			this.onEventClick = opts.onEventClick || function(){};
			this.onEventMouseOut = opts.onEventMouseOut || function(){};
			this.onMonthChanged = opts.onMonthChanged || function(){};
			this.beforeDraw = (opts.beforeDraw || function(){}).bind(this);
			this.events = [];
			this.month = opts.hasOwnProperty('month') ? opts.month-1 : (new Date()).getMonth();
			this.year = opts.hasOwnProperty('year') ? opts.year : (new Date()).getFullYear();
			this.ellipse = opts.hasOwnProperty('ellipse') ? opts.ellipse : true;
			this.daysOfWeekFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
			this.daysOfWeekAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			this.monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
			this.monthsAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			this.mode = opts.hasOwnProperty('mode') ? opts.mode : 'other';
			
			opts.events = opts.events || [];
			for(var i=opts.events.length; i--;) this.addEvent(opts.events[i], false);
			
			if (this.mode == "dark") {
				this.backgroundColor = "#2A2A2A";
				this.textColor = "#FFFFFF";
				this.borderColor = "#C8C8C8";
			} else {
				this.backgroundColor = "#FFFFFF";
				this.textColor = "#000000";
				this.borderColor = "#000000";
			}

			this.elem.classList.add("CalendarJS");
			
			// Built-in event handlers
			this._loadNextMonth = this.loadNextMonth.bind(this);
			this._loadPrevMonth = this.loadPreviousMonth.bind(this);
			
			this._dayClicked = function(e){
				var evtids = e.target.getAttribute('data-events').split(",");
				var evts = [];
				for(var i=0; i<evtids.length; i++) 
					if(this.events[evtids[i]]!==undefined) 
						evts.push(this.events[evtids[i]]);
				var date = new Date(this.year, this.month, e.target.getAttribute('data-day'));
				this.onDayClick.call(this, date, evts);
			}.bind(this);
			
			this._eventClicked = function(e){
				var target = e.target.tagName === 'SPAN' ? e.target.parentElement : e.target;
				var evtid = target.getAttribute('data-eventid');
				this.onEventClick.call(this, this.events[evtid]);
			}.bind(this);

			this._eventMouseOut = function(e){
				var target = e.target.tagName === 'SPAN' ? e.target.parentElement : e.target;
				var evtid = target.getAttribute('data-eventid');
				this.onEventMouseOut.call(this, this.events[evtid]);
			}.bind(this);
			
			this.drawCalendar();
		}
		
		/**
		 * Add a date to the disabled dates list
		 * @param {type} date
		 * @returns {undefined}
		 */
		disableDate(date){
			var formatted = this.formatDateMMDDYY(date);
			if(!this.disabledDates.includes(formatted)){
				this.disabledDates.push(formatted);
			}
		}
		
		/**
		 * Given a Date object, format and return date string in format MM/DD/YYYY (without leading zeroes)
		 * @param {Date} date
		 * @returns {String}
		 */
		formatDateMMDDYY(date){
			return (date.getMonth() + 1) + "/" +
					date.getDate() + "/" +
					date.getFullYear();
		}
		
		/**
		 * Add an event to the calendar
		 * @param {object} evt
		 * @returns {Calendar instance}
		 */
		async addEvent(evt, draw=true){
			var hasDesc = (evt.hasOwnProperty("desc")),
				hasDate = (evt.hasOwnProperty("date")),
				hasStartDate = (evt.hasOwnProperty("startDate")),
				hasEndDate = (evt.hasOwnProperty("endDate")),
				hasColor = (evt.hasOwnProperty("color"));
			if (hasDesc && hasColor && (hasDate  || (hasStartDate && hasEndDate))) {
				if (hasStartDate && hasEndDate) {
					if (+evt.startDate <= +evt.endDate) {
						this.events.push(evt);
					} else {
						throw new Error("Start date must occur before end date.");
					}
				} else {
					this.events.push(evt);
				}
			} else {
				throw new Error("All events must have a 'desc' property and either a 'date' property or a 'startDate' and 'endDate' property");
			}

			if (draw) await this.drawCalendar();
			return this;
		}
		
		/**
		 * Load the next month to the calendar
		 * @returns {Calendar instance}
		 */
		async loadNextMonth () {
			this.month = this.month - 1 > -1 ? this.month - 1 : 11;
			if (this.month === 11) this.year--;
			await this.drawCalendar();
			this.onMonthChanged.call(this, this.month+1, this.year);
			return this;
		}
		
		/**
		 * Load the previous month to the calendar
		 * @returns {Calendar instance}
		 */
		async loadPreviousMonth(){
			this.month = this.month + 1 > 11 ? 0 : this.month+1;
			if(this.month===0) this.year++;
			await this.drawCalendar();
			this.onMonthChanged.call(this, this.month+1, this.year);
			return this;
		}
		
		/**
		 * Get a list of eventts in a certain time range
		 * @param {date} date1
		 * @param {date} date2
		 * @returns {Array of events in range}
		 */
		getEventsDuring(date1, date2){
			if(undefined === date2) date2 = date1;
			var lowdate = +date1>+date2 ? date2 : date1;
			var highdate = +date1>+date2 ? date1 : date2;

			var morn = +(new Date(lowdate.getFullYear(), lowdate.getMonth(), lowdate.getDate(), 0, 0, 0));
			var night = +(new Date(highdate.getFullYear(), highdate.getMonth(), highdate.getDate(), 23, 59, 59));

			var result = [];
			for(let i=0; i<this.events.length; i++){
				if(this.events[i].hasOwnProperty("startDate")){
					var eventStart = +this.events[i].startDate;
					var eventEnd = +this.events[i].endDate;
				}else{
					var eventStart = +this.events[i].date;
					var eventEnd = +this.events[i].date;
				}
				var startsToday = (eventStart>=morn && eventStart<=night);
				var endsToday = (eventEnd>=morn && eventEnd<=night);
				var continuesToday = (eventStart<morn && eventEnd>night);

				if(startsToday || endsToday || continuesToday) result.push(this.events[i]);
			}
			return result;
		}
		
		/**
		 * Clear the selected dates
		 * @returns {Calendar instance}
		 */
		clearSelection(){
			var active = this.elem.getElementsByClassName("cjs-active");
			for(let i=active.length; i--;) active[i].classList.remove('cjs-active');
			this.selectedDates = [];
			return this;
		}
		
		/**
		 * Select a date from teh calendar
		 * @param {date} date
		 * @returns {Calendar instance}
		 */
		selectDate(date){
			if(this.month !== date.getMonth()) return;
			if(this.year !== date.getFullYear()) return;
			this.elem.getElementsByClassName("cjs-dayCell"+(date.getDate()))[0]
				.parentNode.parentNode.parentNode.classList.add("cjs-active");
			this.selectedDates.push({
				day: date.getDate(),
				month: date.getMonth(),
				year: date.getFullYear()
			});
			return this;
		}
		
		/**
		 * Select a range of dates
		 * @param {date} date1
		 * @param {date} date2
		 * @returns {Calendar instance}
		 */
		selectDateRange(date1, date2){
			if(this.month !== date1.getMonth()) return;
			if(this.year !== date1.getFullYear()) return;
			if(this.month !== date2.getMonth()) return;
			if(this.year !== date2.getFullYear()) return;
			var lowdate = +date1>+date2 ? date2.getDate() : date1.getDate();
			var highdate = +date1>+date2 ? date1.getDate() : date2.getDate();
			for(let i=lowdate; i<=highdate; i++)
				this.selectDate(new Date(this.year, this.month, i));
			return this;
		}
		
		/**
		 * Get an array of dates that are selected
		 * @returns {Array of dates}
		 */
		getSelection(){
			var sel = [];
			for(let i=0; i<this.selectedDates.length; i++) 
				sel.push(new Date(this.selectedDates[i].year, this.selectedDates[i].month, this.selectedDates[i].day));
			return sel;
		}
		
		/**
		 * Get current month as object that contains month and year
		 * @returns {calendarcalendar.Calendar.getCurrentMonth.calendarAnonym$1}
		 */
		getCurrentMonth(){
			return {
				month: this.month +1,
				year: this.year
			}
		}
		
		/**
		 * Draw the calendar instance
		 * @returns {calendarcalendar.Calendar@call;_setCalendarEvents@call;_positionEventGroups}
		 */
		async drawCalendar(){ 
			if(typeof this.beforeDraw === 'function'){
				await this.beforeDraw();
			}
			
			// clear the element
			this.elem.innerHTML = "";
			this._eventGroups = [];
			let firstDayofWeek = new Date(this.year, this.month, 1).getDay();
			let	lastDateOfMonth = new Date(this.year, this.month + 1, 0).getDate();
			let	currentDate = 1;
			let	currentDayOfWeek = 0;
			let	currentWeek = 0;

			// draw title bar
			let yearTitle = this.abbrYear ? "'" + ("" + this.year).substring(2,4) : this.year;
			let monthArrayName = this.abbrMonth ? "monthsAbbr" : "monthsFull";
			let monthTitle = this[monthArrayName][this.month];
			let prevMonth = this.monthsAbbr[this.month-1] ? this.monthsAbbr[this.month-1] : this.monthsAbbr[11];
			let nextMonth = this.monthsAbbr[this.month+1] ? this.monthsAbbr[this.month+1] : this.monthsAbbr[0];
			this.elem.insertAdjacentHTML('beforeend', "<div class='cjs-weekRow cjs-calHeader'><div style='background:" + this.backgroundColor + "; color:" + this.textColor + "; border-color:" + this.borderColor +";' class='cjs-prevLink'>&vltri; "+ prevMonth + "</div><div style='background:" + this.backgroundColor + "; color:" + this.textColor + "; border-color:" + this.borderColor +";' class='cjs-nextLink'>" + nextMonth + " &vrtri;</div><div style='background:" + this.backgroundColor + "; color:" + this.textColor + ";' class='cjs-moTitle'>" + monthTitle + " " + yearTitle + "</div></div>");
			
			// Draw day labels
			var dayArrayName = this.abbrDay ? "daysOfWeekAbbr" : "daysOfWeekFull";
			var dayNames = makeEle("div", {class: "cjs-weekRow"});
			for(let i=0; i < this[dayArrayName].length; i++){ 
				let directionalClass = "";
				if(i===6) directionalClass = " cjs-right cjs-top-right";
				if(i===0) directionalClass += " cjs-top-left";
				dayNames.insertAdjacentHTML('beforeend', "<div style='background:" + this.backgroundColor + "; color:" + this.textColor + "; border-color:" + this.borderColor +";' class='cjs-dayCol cjs-left cjs-top cjs-bottom cjs-dayHeader" + directionalClass + "'><div class='cjs-dayHeaderCell'>" + this[dayArrayName][i] + "</div></div>");
			}
			this.elem.appendChild(dayNames);
			
			// Loop through weeks
			while(currentDate <= lastDateOfMonth){
				currentDayOfWeek = 0;

				// draw a div for the week
				var week = makeEle("div", {class: "cjs-weekRow calweekid" + currentWeek});

				// draw days before the 1st of the month
				while(currentDate===1 && currentDayOfWeek < firstDayofWeek){
					week.insertAdjacentHTML('beforeend', "<div style='background:" + this.backgroundColor + "; border-color:" + this.borderColor +";' class='cjs-dayCol cjs-blankday cjs-bottom cjs-left'><div class='cjs-dayContent'><div class='cjs-dayTable'><div class='cjs-dayCell'></div></div></div></div>");
					currentDayOfWeek++;
				}

				// Store the events
				let weekEvents = {};
				let dayEvents = {};
				
				// Loop through days
				while(currentDayOfWeek < 7 && currentDate <= lastDateOfMonth) {
					// get events
					var evtids = [];
					for (var n=0; n < this.events.length; n++) {	
						if (!this.events[n].hasOwnProperty('date')) {
							var morn = +(new Date(this.year, this.month, currentDate, 0, 0, 0));
							var night = +(new Date(this.year, this.month, currentDate, 23, 59, 59));
							var eventStart = +this.events[n].startDate;
							var eventEnd = +this.events[n].endDate;
							var startsToday = (eventStart>=morn && eventStart<=night);
							var endsToday = (eventEnd>=morn && eventEnd<=night);
							var continuesToday = (eventStart<morn && eventEnd>night);
							if(startsToday || endsToday || continuesToday){
								if(!weekEvents.hasOwnProperty(n)) weekEvents[n] = {event:this.events[n], eventid:n};
								if(startsToday){
									weekEvents[n].start=currentDayOfWeek;
									weekEvents[n].startdayid=currentDate;
								}
								if(currentDayOfWeek===6||endsToday){
									weekEvents[n].end=currentDayOfWeek;
									weekEvents[n].enddayid=currentDate;
								}
								evtids.push(n);
							}
						}else{
							var yearMatches = (this.events[n].date.getFullYear()===this.year);
							var monthMatches = (this.events[n].date.getMonth()===this.month);
							var dayMatches = (this.events[n].date.getDate()===currentDate);
							if(yearMatches && monthMatches && dayMatches){
								if(!dayEvents.hasOwnProperty(n)) dayEvents[n] = {event:this.events[n], startdayid:currentDate, enddayid:currentDate, start:currentDayOfWeek, end:currentDayOfWeek, eventid:n};
								evtids.push(n);
							}
						}
					}
					
					var isDisabled = this.disabledDates.includes(`${this.month + 1}/${currentDate}/${this.year}`);
					var directionalClass = "";
					if(currentDayOfWeek===6) directionalClass = " cjs-right";
					if((lastDateOfMonth-currentDate)<7){
						if(currentDayOfWeek===0) directionalClass += " cjs-bottom-left";
						if(currentDayOfWeek===6&&currentDate===lastDateOfMonth) directionalClass += " cjs-bottom-right";
					} 
					// draw day
					week.insertAdjacentHTML('beforeend', "<div style='background:" + this.backgroundColor + "; border-color:" + this.borderColor +";' class='cjs-dayCol cjs-bottom cjs-left" + directionalClass + " " + (isDisabled ? 'cjs-blankday' : '') + "'><div class='cjs-dayContent'><div class='cjs-dayTable'><div style='color:" + this.textColor + ";' class='cjs-dayCell "+(isDisabled ? '' : 'cjs-calDay')+" cjs-dayCell"+currentDate+"' data-day='"+currentDate+"' data-events='"+(evtids.join(","))+"'><span class='cjs-dateLabel'>" + currentDate + "</span> </div></div></div></div>");
					currentDate++;
					currentDayOfWeek++;
				}

				// draw empty days after last day of month
				while(currentDayOfWeek<7){
					var directionalClass = " cjs-left";
					if(currentDayOfWeek===6) directionalClass += " cjs-right cjs-bottom-right";
					week.insertAdjacentHTML('beforeend', "<div style='background:" + this.backgroundColor + "; border-color:" + this.borderColor +";' class='cjs-dayCol cjs-blankday cjs-bottom" + directionalClass + "'><div class='cjs-dayContent'><div class='cjs-dayTable'><div class='cjs-dayCell'></div></div></div></div>");
					currentDayOfWeek++;
				}
				this.elem.appendChild(week);

				// Draw weekEvents, dayEvents
				for(let eid in weekEvents){
					if(!weekEvents.hasOwnProperty(eid)) continue;
					if(!weekEvents[eid].hasOwnProperty("start")){
						weekEvents[eid].start = 0;
						weekEvents[eid].startdayid=weekEvents[eid].enddayid-weekEvents[eid].end;
					}
					weekEvents[eid].week = currentWeek;
					var egid = this._eventGroups.length;
					this._eventGroups.push(weekEvents[eid]);
					var cls = (undefined===this.events[eid].type) ? "" : " "+this.events[eid].type;
					var desc = this.events[eid].desc;
					let color = this.events[eid].color;
					if(this.ellipse) desc = "<span>"+desc+"</span>", cls+=" cjs-ellipse";
					var evt = "<div style=\"background:" + color + "; border-color:" + this.borderColor + "\" class='cjs-calEvent" + egid + " cjs-calEvent" + cls + "' data-eventid='" + this._eventGroups[egid].eventid + "'>" + desc + "</div>";
					week.insertAdjacentHTML('beforeend', evt);
				}
				for(var eid in dayEvents){
					if(!dayEvents.hasOwnProperty(eid)) continue;
					dayEvents[eid].week = currentWeek;
					var egid = this._eventGroups.length;
					this._eventGroups.push(dayEvents[eid]);
					var cls = (undefined===this.events[eid].type) ? "" : " "+this.events[eid].type;
					var desc = this.events[eid].desc;
					if(this.ellipse) desc = "<span>"+desc+"</span>", cls+=" cjs-ellipse";
					var evt = "<div class='cjs-calEvent"+egid+" cjs-calEvent"+cls+"' data-eventid='"+this._eventGroups[egid].eventid+"'>"+desc+"</div>";
					week.insertAdjacentHTML('beforeend', evt);
				}
				currentWeek++;
			}
			var wks = this.elem.getElementsByClassName("cjs-weekRow");
			for(var i=wks.length; i--;) wks[i].insertAdjacentHTML('beforeend', "<div class='cjs-clearfix'></div>");
			return this._setCalendarEvents()._positionEventGroups();
		}
		
		/**
		 * Position events in their cells
		 * @returns {Calendar instance}
		 */
		_positionEventGroups(){
			var eventPositions = {}; // available positions within the display area
			var otherEvents = {}; // events that don't fit in the display area
			
			for(let i = 0; i < this._eventGroups.length; i++){
				let e = this._eventGroups[i],
					ele = this.elem.getElementsByClassName('cjs-calEvent'+i)[0],
					dayCellHt = this.elem.getElementsByClassName("cjs-dayCell")[0].getBoundingClientRect().height,
					dayColHt = this.elem.getElementsByClassName("cjs-dayCol")[7].getBoundingClientRect().height,
					dayColWd = this.elem.getElementsByClassName("cjs-dayCol")[7].getBoundingClientRect().width,
					dateLabelHeight = this.elem.getElementsByClassName("cjs-dateLabel")[0].getBoundingClientRect().height,
					evtHtOffset = ele.getBoundingClientRect().height+2,
					paddingOffset = Math.floor((dayColHt-dayCellHt)/2),
					top = 3+paddingOffset+dateLabelHeight,
					left = 1+paddingOffset+(dayColWd*e.start),
					width = ((e.end-e.start+1)*dayColWd)-(paddingOffset*3),
					bottomBorder = dayColHt - paddingOffset;

				// get the lowest event position available for every date in event
				let posit = false;
				let allAvail = [];
				for(let n=e.startdayid; n<=e.enddayid; n++){
					if(!eventPositions.hasOwnProperty(n)) eventPositions[n]=[];
					// get the lowest available event position for this day
					for(let x=0; x<=eventPositions[n].length; x++){
						if(undefined===eventPositions[n][x]) eventPositions[n][x] = 0;
						if(eventPositions[n][x]===0){
							allAvail.push(x); 
							break;
						}
					}
				}
				for(let aa=allAvail.length; aa--;){
					if(posit===false) posit = allAvail[aa];
					if(allAvail[aa]>posit) posit = allAvail[aa];
				}
				// posit is now the lowest position available for every date
				// make sure it fits
				let eventBottom = top+(evtHtOffset*(1+posit))-2;
				if(eventBottom > bottomBorder){
					// event doesn't fit
					let newendid = e.startdayid;
					let newend = e.start;
					let lastPositAvailable = false;
					// see if event fits in any of the other cols
					// if so shrink this one, reset the starting pos
					// add "other events" counter to upper right of this date
					// there is a position above, check if it's available
					if(posit > 0){
						// get the first available position for the first day of the event
						for(let p=posit;p--;) if(eventPositions[e.startdayid][p]===0) lastPositAvailable=p;
						// if a higher position is available for the first date
						if(lastPositAvailable!==false){
							// check subsequent dates to see if the same position is available
							// to figure out new end date
							for(let n=e.startdayid; n<=e.enddayid; n++){
								if(undefined===eventPositions[n][lastPositAvailable]) eventPositions[n][lastPositAvailable] = 0;
								// if this position is available for this day too
								// increase the enddate, else break at the existing end date
								if(eventPositions[n][lastPositAvailable]===0){ 
									newendid++;
									newend++;
								}else{
									newendid--;
									newend--;
									break;
								}
							}
						}
					}
					// check newend and newposit and adjust event if possible
					// or else add a +1 to the "other events" counter for this day
					if(lastPositAvailable===false){
						// no positions are available for this day
						// add +1 to "other events" counter for this day ..check
						// and if the is another day in the event 
						// make the current this._eventGroups start one day later 
						// and do i-- and continue the loop so it will be iterated over again
						if(undefined===otherEvents[e.startdayid]) otherEvents[e.startdayid] = 0;
						otherEvents[e.startdayid]++;
						if(e.startdayid<e.enddayid){
							e.startdayid++;
							e.start++;
							i--;
						}else{
							// there are no more days to show, hide the event
							ele.classList.add('cjs-hidden');
						}
						continue;
					}else{
						// we have a partial fit
						// make the current this._eventGroups end on the new end date (adjust the width, top)
						// then add a new event group starting one day later in case there are other spaces available
						// on the other side of the full day
						// also, update eventPositions to show taken dates
						if(ele.classList.contains('cjs-hidden')) ele.classList.remove('cjs-hidden');
						let oldendid = e.enddayid;
						let oldend = e.end;
						e.enddayid=newendid;
						e.end=newend;
						width = ((newend-e.start+1)*dayColHt)-(paddingOffset*3);
						posit = lastPositAvailable;
						let egid = this._eventGroups.length;
						this._eventGroups.push({
							enddayid: oldendid,
							end: oldend,
							startdayid: newendid+1,
							start: newend+1,
							event: e.event,
							week: e.week
						});
						let cls = (undefined===e.event.type) ? "" : " "+e.event.type;
						let desc = e.event.desc;
						if(this.ellipse) desc = "<span>"+desc+"</span>", cls+=" cjs-ellipse";
						let evt = "<div class='cjs-calEvent"+egid+" cjs-calEvent"+cls+"' data-eventid='"+this._eventGroups[egid].eventid+"'>"+desc+"</div>";
						let week = this.elem.getElementsByClassName("calweekid"+e.week)[0];
						week.insertAdjacentHTML('beforeend', evt);
						for(let n=e.startdayid; n<=e.enddayid; n++) eventPositions[n][lastPositAvailable] = 1;
					}
				} else {
					// the event fits completely,
					// update eventPositions for every day in the eventgroup
					// no adjustmetns are needed
					if (ele.classList.contains('cjs-hidden')) {
						ele.classList.remove('cjs-hidden');
					}

					for(let n = e.startdayid; n <= e.enddayid; n++) {
						eventPositions[n][posit] = 1;
					}
				}

				// adjust top position for other events
				if(posit!==0) top += (evtHtOffset*posit);
				let h = ele.parentNode.getBoundingClientRect().height;
				let w = ele.parentNode.getBoundingClientRect().width;
				ele.style.top = (top/h*100)+"%";
				ele.style.left = (left/w*100)+"%";
				ele.style.width = (width/w*100)+"%";
			}

			// Draw otherEvents for events that didnt fit in the display
			for(let date in otherEvents){
				if(!otherEvents.hasOwnProperty(date)) continue;
				let d = this.elem.getElementsByClassName("cjs-dayCell"+date)[0];
				d.insertAdjacentHTML('beforeend', '<div class="cjs-otherEvents">+'+otherEvents[date]+'</div>');
			}
			return this;
		}
		
		/**
		 * Set the events handlers on the calendar
		 * @returns {Calendar instance}
		 */
		_setCalendarEvents(){
			var lastLink = this.elem.getElementsByClassName("cjs-prevLink")[0];
			removeEventListener(lastLink, 'click', this._loadNextMonth);
			addEventListener(lastLink, 'click', this._loadNextMonth);

			var nextLink = this.elem.getElementsByClassName("cjs-nextLink")[0];
			removeEventListener(nextLink, 'click', this._loadPrevMonth);
			addEventListener(nextLink, 'click', this._loadPrevMonth);

			var calDays = this.elem.getElementsByClassName("cjs-calDay");
			for(let i=calDays.length; i--;){
				removeEventListener(calDays[i], 'click', this._dayClicked);
				addEventListener(calDays[i], 'click', this._dayClicked);
			}

			var events = this.elem.getElementsByClassName('cjs-calEvent');
			for(let i=events.length; i--;){
				removeEventListener(events[i], 'click', this._eventClicked);
				addEventListener(events[i], 'mouseenter', this._eventClicked);
				addEventListener(events[i], 'mouseleave', this._eventMouseOut);
			}
			return this;
		}
	}
	
	return Calendar;
	
})();



/*
 * Copyright © 2023. Cloud Software Group, Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

//@ts-check - Get type warnings from the TypeScript language server. Remove if not wanted.

/**
 * Get access to the Spotfire Mod API by providing a callback to the initialize method.
 * @param {Spotfire.Mod} mod - mod api
 */
Spotfire.initialize(async (mod) => {
	/**
	 * Create the read function.
	 */
	const reader = mod.createReader(
		mod.visualization.data(),
		mod.visualization.axis("Color"),
		mod.windowSize(), 
		mod.property("myProperty")
	);

	/**
	 * Store the context.
	 */
	const context = mod.getRenderContext();

	/**
	 * Initiate the read loop
	 */
	reader.subscribe(render);

	/**
	 * @param {Spotfire.DataView} dataView
	 * @param {Spotfire.DataViewCategoricalValue} dataViewCategoricalValue
	 * @param {Spotfire.Size} windowSize
	 * @param {Spotfire.ModProperty<string>} prop
	 */
	async function render(dataView, dataViewCategoricalValue, windowSize, prop) {
		/**
		 * Check the data view for errors
		 */
		let errors = await dataView.getErrors();
		if (errors.length > 0) {
			// Showing an error overlay will hide the mod iframe.
			// Clear the mod content here to avoid flickering effect of
			// an old configuration when next valid data view is received.
			mod.controls.errorOverlay.show(errors);
			return;
		}
		mod.controls.errorOverlay.hide();

		const mode = (context.styling.general.backgroundColor == "#2A2A2A") ? "dark" : "other";

		/**
		 * Get the hierarchy of Task, Start, and End.
		 */
		const root = await (await dataView.hierarchy("Task")).root();

		if (root == null) {
			// User interaction caused the data view to expire.
			// Don't clear the mod content here to avoid flickering.
			return
		}

		let minDate = getMinDate(root);
		let minDateArray = minDate.split("/");
		var element = document.getElementById('calendar');
		var options = {
			month: minDateArray[1],
			year: minDateArray[0],
			abbrDay: false,
			abbrMonth: false,
			abbrYear: false,
			mode: mode,
			onEventClick: function(event) {
				mod.controls.tooltip.show([
					[
						event.desc,
						"",
						"Start date: " + event.startDateFormatted,
						"End date: " + event.endDateFormatted
					].join("\n")
				]);
			},
			onEventMouseOut: function(event) {
				mod.controls.tooltip.hide();
			}
		};
		var cal = new calendar(element, options);

		buildTasks(root);

		function buildTasks(taskNode) {
			taskNode.children.forEach(addTask);
		}

		function addTask(node) {
			let tasks = node.rows().map((r) => r.categorical("Task").formattedValue());
			let startDates = node.rows().map((r) => r.continuous("Start").formattedValue());
			let endDates = node.rows().map((r) => r.continuous("End").formattedValue());
			let colorValues = node.rows().map((r) => r.color().hexCode);
			
			for (let i = 0; i < tasks.length; i++) {
				start = new Date(startDates[i]);
				end = new Date(endDates[i]);
				cal.addEvent({
					desc: `${tasks[i]}`,
					startDate: start,
					endDate: end,
					startDateFormatted: startDates[i],
					endDateFormatted: endDates[i],
					color: `${colorValues[i]}`,
				})
			}
		}

		function getMinDate(rootNode) {
			let dates = [];
			rootNode.children.forEach((node) => {
				let startDates = node.rows().map((r) => r.continuous("Start").formattedValue());

				for (let i = 0; i < startDates.length; i++) {
					let currentDate = new Date(startDates[i])
					dates.push(currentDate);
				}
			});

			dates.sort(function(a,b){return a.getTime() - b.getTime()});
			return dates[0].toISOString().slice(0,10).replace(/-/g,"/");
		}
	}
});
