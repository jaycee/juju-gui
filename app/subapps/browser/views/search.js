'use strict';


/**
 * Provides searching functionality for the charm browser.
 *
 * @namespace juju
 * @module browser
 * @submodule views
 */
YUI.add('subapp-browser-searchview', function(Y) {
  var ns = Y.namespace('juju.browser.views'),
      views = Y.namespace('juju.views'),
      widgets = Y.namespace('juju.widgets'),
      models = Y.namespace('juju.models');

  ns.BrowserSearchView = Y.Base.create('browser-view-searchview', Y.View, [
    views.utils.apiFailingView,
    Y.Event.EventTracker
  ], {
    events: {
      '.charm-token': {
        click: '_handleCharmSelection'
      }
    },

    template: views.Templates.search,

    /**
        When selecting a charm from the list make sure we re-route the app to
        the details view with that charm selected.

        @method _handleCharmSelection
        @param {Event} ev the click event handler for the charm selected.

     */
    _handleCharmSelection: function(ev) {
      ev.halt();
      var charm = ev.currentTarget;
      var charmID = charm.getData('charmid');

      // Update the UI for the active one.
      if (!this.get('isFullscreen')) {
        this._updateActive(ev.currentTarget);
      }
      var change = {
        charmID: charmID
      };
      this.fire('viewNavigate', {change: change});
    },

    /**
      Update the node in the editorial list marked as 'active'.
      @method _updateActive
      @param {Node} clickTarget the charm-token clicked on to activate.

    */
    _updateActive: function(clickTarget) {
      // Remove the active class from any nodes that have it.
      Y.all('.yui3-charmtoken.active').removeClass('active');

      // Add it to the current node.
      clickTarget.ancestor('.yui3-charmtoken').addClass('active');
    },

    /**
     * Renders the search results from the the store query.
     *
     * @method _renderSearchResults
     */
    _renderSearchResults: function(results) {
      var target = this.get('renderTo'),
          tpl = this.template({count: results.size()}),
          tplNode = Y.Node.create(tpl),
          container = tplNode.one('.search-results'),
          filter_container = tplNode.one('.search-filters');

      // Set the container so that our events will delegate based off of it.
      this.set('container', container);

      results.map(function(charm) {
        var ct = new widgets.browser.CharmToken(charm.getAttrs());
        ct.render(container);
      });
      this._renderFilterWidget(filter_container);
      target.setHTML(tplNode);
    },

    _renderFilterWidget: function(container) {
      this.filters = new widgets.browser.Filter({
        filters: this.get('filters')
      });

      if (!this.get('isFullscreen')) {
        return;
      }
      this.filters.render(container);
      this.filters.on(this.filters.EV_FILTER_CHANGED, function(ev) {
        var filters = this.get('filters');
        filters[ev.change.field] = ev.change.value;
        var change = {
          filter: {
          }
        }
        change['filter'][ev.change.field] = ev.change.value;
        this.fire('viewNavigate', {change: change});
      }, this);
    },

    /**
     * Generates a message to the user based on a bad api call.
     *
     * @method apiFailure
     * @param {Object} data the json decoded response text.
     * @param {Object} request the original io_request object for debugging.
     *
     */
    apiFailure: function(data, request) {
      this._apiFailure(data, request, 'Failed to load search results.');
    },

    /**
     * Renders the searchview, rendering search results for the view's search
     * text.
     *
     * @method render
     */
    render: function() {
      this.get('store').search(this.get('filters'), {
        'success': function(data) {
          var results = this.get('store').resultsToCharmlist(data.result);
          this._renderSearchResults(results);
        },
        'failure': this.apiFailure
      }, this);
    }
  }, {
    ATTRS: {
      /**
       * The container node the view is rendering to.
       *
       * @attribute renderTo
       * @default undefined
       * @type {Y.Node}
       */
      renderTo: {},

      /**
       * An instance of the Charmworld API object to hit for any data that
       * needs fetching.
       *
       * @attribute store
       * @default undefined
       * @type {Charmworld0}
       *
       */
      store: {},

      /**
       * The search data object which is a Filter instance.
       *
       * @attribute filters
       * @default undefined
       * @type {Filter}
       */
      filters: {}
    }
  });

}, '0.1.0', {
  requires: [
    'base-build',
    'browser-charm-token',
    'browser-overlay-indicator',
    'event-tracker',
    'juju-browser-models',
    'juju-view-utils',
    'view'
  ]
});
