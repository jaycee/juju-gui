'use strict';

YUI.add('juju-topology-panzoom', function(Y) {
  var views = Y.namespace('juju.views'),
      models = Y.namespace('juju.models'),
      d3ns = Y.namespace('d3');

  /**
   * Handle PanZoom within the a Topology.
   *
   * @module topology-panzoom
   * @class PanZoomModule
   * @namespace views
   **/
  var PanZoomModule = Y.Base.create('PanZoomModule', d3ns.Module, [], {

    events: {
      scene: {
        '#zoom-out-btn': {click: 'zoom_out'},
        '#zoom-in-btn': {click: 'zoom_in'},
      }
    },

    initializer: function(options) {
      PanZoomModule.superclass.constructor.apply(this, arguments);
    },

    componentBound: function() {
      var topo = this.get('component'),
          vis = topo.vis;

      // Directly invoke the handler on bind
      this.sizeChangeHandler();
      // And register it as a subscribed event handler.
      // XXX: we have to manually do this until either
      // I add a slots/signals model to the framework
      // or we let the declaration specify a target object.
      // At first glance saying context:
      // component|module|component-attr|module-attr
      // for the yui event block make sense, but some
      // attrs would not exist until late in runtime
      // so I lean towards slots.
      topo.recordSubscription(
        topo.on('sizeChanged', this.sizeChangeHandler);
      );

      // Bind zoom behavior and disable
      // dblclick to zoom.
      vis.call(this.zoom)
         .on('dblclick.zoom', null);
    },

    sizeChangeHandler: function() {
      var component = this.get('component'),
          width = component.get('width'),
          height = component.get('height'),
          vis = component.vis;

      // Create a pan/zoom behavior manager.
      this.xscale = d3.scale.linear()
      .domain([-width / 2, width / 2])
      .range([0, width]),
      this.yscale = d3.scale.linear()
      .domain([-height / 2, height / 2])
      .range([height, 0]);

      var zoom = d3.behavior.zoom()
                   .x(this.xscale)
                   .y(this.yscale)
                   .scaleExtent([0.25, 2.0])
                   .on('zoom', function() {
                     // Keep the slider up to date with the scale on other sorts
                     // of zoom interactions
                     var s = self.slider;
                     s.set('value', Math.floor(d3.event.scale * 100));
                     self.rescale(vis, d3.event);
                   });
      self.zoom = zoom;

    }

    render: function() {
      PanZoomModule.superclass.render.apply(this, arguments);
      this.renderSlider();
      return this;
    },

    renderSlider: function() {
      var self = this,
          topo = this.get('component'),
          contianer = topo.get('container'),
          value = 100,
          currentScale = topo.get('scale');
      // Build a slider to control zoom level
      if (currentScale) {
        value = currentScale * 100;
      }
      var slider = new Y.Slider({
        min: 25,
        max: 200,
        value: value
      });
      slider.render('#slider-parent');
      slider.after('valueChange', function(evt) {
        // Don't fire a zoom if there's a zoom event already in progress;
        // that will run rescale for us.
        if (d3.event && d3.event.scale && d3.event.translate) {
          return;
        }
        self._fire_zoom((evt.newVal - evt.prevVal) / 100);
      });
      self.slider = slider;
    },


    update: function() {
      PanZoomModule.superclass.update.apply(this, arguments);
      return this;
    }

    /*
     * Zoom out event handler.
     */
    zoom_out: function(data, context) {
      var slider = context.slider,
              val = slider.get('value');
      slider.set('value', val - 25);
    },

    /*
     * Zoom in event handler.
     */
    zoom_in: function(data, context) {
      var slider = context.slider,
              val = slider.get('value');
      slider.set('value', val + 25);
    },

    /*
     * Wraper around the actual rescale method for zoom buttons.
     */
    _fire_zoom: function(delta) {
      var vis = this.vis,
          zoom = this.zoom,
          evt = {};

      // Build a temporary event that rescale can use of a similar
      // construction to d3.event.
      evt.translate = zoom.translate();
      evt.scale = zoom.scale() + delta;

      // Update the scale in our zoom behavior manager to maintain state.
      zoom.scale(evt.scale);

      // Update the translate so that we scale from the center
      // instead of the origin.
      var rect = vis.select('rect');
      evt.translate[0] -= parseInt(rect.attr('width'), 10) / 2 * delta;
      evt.translate[1] -= parseInt(rect.attr('height'), 10) / 2 * delta;
      zoom.translate(evt.translate);

      this.rescale(vis, evt);
    },

    /*
         * Rescale the visualization on a zoom/pan event.
         */
    rescale: function(vis, evt) {
      // Make sure we don't scale outside of our bounds.
      // This check is needed because we're messing with d3's zoom
      // behavior outside of mouse events (e.g.: with the slider),
      // and can't trust that zoomExtent will play well.
      var new_scale = Math.floor(evt.scale * 100);
      if (new_scale < 25 || new_scale > 200) {
        evt.scale = this.get('scale');
      }
      // Store the current value of scale so that it can be restored later.
      this.set('scale', evt.scale);
      // Store the current value of translate as well, by copying the event
      // array in order to avoid reference sharing.
      this.set('translate', evt.translate.slice(0));
      vis.attr('transform', 'translate(' + evt.translate + ')' +
              ' scale(' + evt.scale + ')');
      this.updateServiceMenuLocation();
    },


  }, {
    ATTRS: {}

  });
  views.PanZoomModule = PanZoomModule;
}, '0.1.0', {
  requires: [
    'd3',
    'd3-components',
    'node',
    'event',
    'juju-models',
    'juju-env'
  ]
});
