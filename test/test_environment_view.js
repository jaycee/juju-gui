'use strict';

(function() {

  describe('juju environment view', function() {
    var views, models, Y, container, service, db, conn,
        juju, env, testUtils;

    var environment_delta = {
      'result': [
        ['service', 'add', {
          'charm': 'cs:precise/wordpress-6',
          'id': 'wordpress',
          'exposed': false,
          'annotations': {'gui.x': 100, 'gui.y': 200}
        }],
        ['service', 'add', {
          'charm': 'cs:precise/mediawiki-3',
          'id': 'mediawiki',
          'exposed': false
        }],
        ['service', 'add', {
          'charm': 'cs:precise/mysql-6',
          'id': 'mysql'
        }],
        ['service', 'add', {
          'subordinate': true,
          'charm': 'cs:precise/puppet-2',
          'id': 'puppet'
        }],
        ['relation', 'add', {
          'interface': 'reversenginx',
          'scope': 'global',
          'endpoints':
           [['wordpress', {'role': 'peer', 'name': 'loadbalancer'}]],
          'id': 'relation-0000000000'
        }],
        ['relation', 'add', {
          'interface': 'juju-info',
          'scope': 'container',
          'endpoints':
           [['wordpress', {'role': 'server', 'name': 'juju-info'}],
            ['puppet', {'role': 'client', 'name': 'juju-info'}]],
          'id': 'relation-0000000007'
        }],
        ['relation', 'add', {
          'interface': 'mysql',
          'scope': 'global',
          'endpoints':
           [['mysql', {'role': 'server', 'name': 'db'}],
            ['wordpress', {'role': 'client', 'name': 'db'}]],
           'id': 'relation-0000000001'
        }],
        ['machine', 'add', {
          'agent-state': 'running',
          'instance-state': 'running',
          'id': 0,
          'instance-id': 'local',
          'dns-name': 'localhost'
        }],
        ['unit', 'add', {
          'machine': 0,
          'agent-state': 'started',
          'public-address': '192.168.122.113',
          'id': 'wordpress/0'
        }],
        ['unit', 'add', {
          'machine': 0,
          'agent-state': 'started',
          'public-address': '192.168.122.113',
          'id': 'mediawiki/0'
        }],
        ['unit', 'add', {
          'machine': 0,
          'agent-state': 'started',
          'public-address': '192.168.122.222',
          'id': 'mysql/0'
        }]
      ],
      'op': 'delta'
    };

    before(function(done) {
      Y = YUI(GlobalConfig).use([
        'juju-views', 'juju-tests-utils', 'juju-env',
        'node-event-simulate', 'juju-gui', 'slider'
      ], function(Y) {
        testUtils = Y.namespace('juju-tests.utils');
        views = Y.namespace('juju.views');
        models = Y.namespace('juju.models');
        conn = new testUtils.SocketStub();
        juju = Y.namespace('juju');
        env = juju.newEnvironment({conn: conn});
        env.connect();
        conn.open();
        done();
      });
    });

    after(function(done)  {
      env.destroy();
      done();
    });

    beforeEach(function() {
      container = Y.Node.create('<div />').setStyle('visibility', 'hidden');
      Y.one('body').prepend(container);
      db = new models.Database();
      // Use a clone to avoid any mutation
      // to the input set (as happens with processed
      // annotations, its a direct reference).
      db.on_delta({data: Y.clone(environment_delta)});
    });

    afterEach(function(done) {
      container.remove(true);
      db.destroy();
      env._txn_callbacks = {};
      conn.messages = [];
      done();
    });

    it('must handle the window resize event', function(done) {
      var view = new views.environment({container: container, db: db}),
          topo,
          beforeResizeEventFired = false;
      view.render();
      topo = view.topo;

      topo.once('beforePageSizeRecalculation', function() {
        // This event must be fired.
        beforeResizeEventFired = true;
      });
      topo.once('afterPageSizeRecalculation', function() {
        // This event must be fired.
        assert.isTrue(beforeResizeEventFired);
        done();
      });
      Y.one('window').simulate('resize');
    });

    // Ensure the environment view loads properly
    it('must be able to render service blocks and relations',
        function() {
          // Create an instance of EnvironmentView with custom env
          var view = new views.environment({
            container: container,
            db: db,
            env: env
          });
          view.render();
          container.all('.service').size().should.equal(4);

          // Count all the real relations.
          (container.all('.relation').size() -
           container.all('.pending-relation').size())
              .should.equal(2);

          // Count all the subordinate relations.
          container.all('.subordinate-rel-group').size()
              .should.equal(1);

          // Verify that the paths render 'properly' where this
          // means no NaN in the paths
          var line = container.one('.relation');
          Y.each(['x1', 'y1', 'x2', 'y2'],
              function(e) {
                Y.Lang.isNumber(
                    parseInt(this.getAttribute(e), 10))
                            .should.equal(true);
              }, line);
        });

    it('must be able to render subordinate and normal services',
        function(done) {
          // Create an instance of EnvironmentView with custom env
          var view = new views.environment({
            container: container,
            db: db,
            env: env
          });
          view.render();
          container.all('.service').size().should.equal(4);
          container.all('.subordinate.service').size().should.equal(1);

          done();
        }
    );

    it('must properly count subordinate relations', function() {
      var view = new views.environment({
        container: container,
        db: db,
        env: env
      });
      var addSubordinate = {
        result: [
          ['service', 'add', {
            'subordinate': true,
            'charm': 'cs:precise/puppet-2',
            'id': 'puppet2'
          }],
          ['relation', 'add', {
            'interface': 'juju-info',
            'scope': 'container',
            'endpoints':
             [['wordpress', {'role': 'server', 'name': 'juju-info'}],
              ['puppet2', {'role': 'client', 'name': 'juju-info'}]],
            'id': 'new-relation-0000000008'
          }]
        ],
        op: 'delta'
      };
      var addRelation = {
        result: [
          ['relation', 'add', {
            'interface': 'juju-info',
            'scope': 'container',
            'endpoints':
             [['mediawiki', {'role': 'server', 'name': 'juju-info'}],
              ['puppet', {'role': 'client', 'name': 'juju-info'}]],
            'id': 'new-relation-0000000009'
          }]
        ],
        op: 'delta'
      };

      view.render();

      var relationModule = view.topo.modules.RelationModule;

      function validateRelationCount(serviceNode, module, count) {
        var service = d3.select(serviceNode.getDOMNode()).datum();
        return module.subordinateRelationsForService(service)
          .length === count;
      }

      container.all('.subordinate.service').each(function(service) {
        validateRelationCount(service, relationModule, 1).should.equal(true);
      });

      db.on_delta({ data: addSubordinate });
      view.update();

      container.all('.subordinate.service').each(function(service) {
        validateRelationCount(service, relationModule, 1).should.equal(true);
      });

      db.on_delta({ data: addRelation });
      view.update();

      validateRelationCount(container.one('.subordinate.service'),
          relationModule, 2).should.equal(true);
    });

    it('must not duplicate nodes when services are added', function() {
      var view = new views.environment({
        container: container,
        db: db,
        env: env
      });
      var tmp_data = {
        result: [
          ['service', 'add', {
            'subordinate': true,
            'charm': 'cs:precise/puppet-2',
            'id': 'puppet2'
          }],
          ['service', 'add', {
            'charm': 'cs:precise/mysql-6',
            'id': 'mysql2'
          }],
          ['unit', 'add', {
            'machine': 0,
            'agent-state': 'started',
            'public-address': '192.168.122.222',
            'id': 'mysql2/0'
          }]
        ],
        op: 'delta'
      };
      view.render();

      db.on_delta({ data: tmp_data });
      view.render();

      container.all('.service').each(function(serviceNode) {
        // There should not be any duplicate nodes within the service.
        serviceNode.all('.service-status').size().should.equal(1);
        serviceNode.all('.name').size().should.equal(1);
        serviceNode.all('.charm-label').size().should.equal(1);
        serviceNode.all('.service-block-image').size().should.equal(1);
      });
    });

    it('must resize the service health graph properly when units are added',
        function() {
          var view = new views.environment({
            container: container,
            db: db,
            env: env
          }),
              tmp_data = {
                result: [
                  ['machine', 'add', {
                    'agent-state': 'running',
                    'instance-state': 'running',
                    'id': 1,
                    'instance-id': 'local',
                    'dns-name': 'localhost'
                  }],
                  ['unit', 'add', {
                    'machine': 1,
                    'agent-state': 'started',
                    'public-address': '192.168.122.114',
                    'id': 'wordpress/1'
                  }]
                ],
                op: 'delta'
              };

          function chartSizedProperly(serviceNode) {
            var node = d3.select(serviceNode);
            var outerRadius = node.attr('data-outerradius');
            var maskWidth = node.select('.service-health-mask')
                .attr('width');
            return parseFloat(outerRadius) === parseFloat(maskWidth) / 2.05;
          }

          container.all('.service').each(function(service) {
            chartSizedProperly(service.getDOMNode()).should.equal(true);
          });

          db.on_delta({ data: tmp_data });

          container.all('.service').each(function(service) {
            chartSizedProperly(service.getDOMNode()).should.equal(true);
          });
        }
    );

    it('must recalculate relation endpoints when services are resized',
        function() {
          var view = new views.environment({
            container: container,
            db: db,
            env: env
          }).render();
          var tmp_data = {
           result: [
             ['machine', 'add', {
               'agent-state': 'running',
               'instance-state': 'running',
               'id': 1,
               'instance-id': 'local',
               'dns-name': 'localhost'
             }],
             ['machine', 'add', {
               'agent-state': 'running',
               'instance-state': 'running',
               'id': 2,
               'instance-id': 'local',
               'dns-name': 'localhost'
             }],
             ['unit', 'add', {
               'machine': 1,
               'agent-state': 'started',
               'public-address': '192.168.122.114',
               'id': 'wordpress/1'
             }],
             ['unit', 'add', {
               'machine': 2,
               'agent-state': 'started',
               'public-address': '192.168.122.114',
               'id': 'wordpress/2'
             }]
           ],
           op: 'delta'
         };

          // Ensure that line endpoints match with calculated endpoints.
          function endpointsCalculatedProperly(relation) {
            var node = d3.select(relation);
            var line = node.select('line');
            var boxpair = node.datum();
            var connectors = boxpair.source
              .getConnectorPair(boxpair.target);

            return parseFloat(line.attr('x1')) === connectors[0][0] &&
           parseFloat(line.attr('y1')) === connectors[0][1] &&
           parseFloat(line.attr('x2')) === connectors[1][0] &&
           parseFloat(line.attr('y2')) === connectors[1][1];
          }

          // Ensure that endpoints match for all services before any
          // service is resized.
          container.all('.rel-group').each(function(relationGroup) {
            endpointsCalculatedProperly(relationGroup.getDOMNode())
              .should.equal(true);
          });

          // Resize the wordpress service.
          db.on_delta({ data: tmp_data });

          // Ensure that endpoints still match for all services, now that
          // one service has been resized.  This is the real test here.
          container.all('.rel-group').each(function(relationGroup) {
            endpointsCalculatedProperly(relationGroup.getDOMNode())
              .should.equal(true);
          });
        }
    );

    it('must be able to place new services properly', function() {
      var view = new views.environment({
        container: container,
        db: db,
        env: env
      }),
          tmp_data = {
            result: [
              ['service', 'add', {
                'subordinate': true,
                'charm': 'cs:precise/puppet-2',
                'id': 'puppet2'
              }],
              ['service', 'add', {
                'charm': 'cs:precise/mysql-6',
                'id': 'mysql2'
              }],
              ['unit', 'add', {
                'machine': 0,
                'agent-state': 'started',
                'public-address': '192.168.122.222',
                'id': 'mysql2/0'
              }]
            ],
            op: 'delta'
          },
          properTransform = /translate\(\d+\.?\d*,\d+\.?\d*\)/;
      view.render();

      container.all('.service').each(function(serviceNode) {
        // Ensure that all initial service nodes' transform attributes are
        // properly formated (i.e.: no NaN values).
        properTransform.test(serviceNode.getAttribute('transform'))
          .should.equal(true);
      });

      db.on_delta({ data: tmp_data });
      view.render();

      container.all('.service').each(function(serviceNode) {
        // Ensure that all new service nodes' transform attributes are properly
        // formatted as well (i.e.: no NaN values).
        properTransform.test(serviceNode.getAttribute('transform'))
          .should.equal(true);

        // There should not be any duplicate nodes within the service.
        serviceNode.all('.service-status').size().should.equal(1);
        serviceNode.all('.name').size().should.equal(1);
        serviceNode.all('.charm-label').size().should.equal(1);
        serviceNode.all('.service-block-image').size().should.equal(1);
      });
    });

    it('must be able to use position annotations',
       function() {
         var view = new views.environment({
           container: container,
           db: db,
           env: env
         });
         var tmp_data = {
           op: 'delta',
           result: [
             ['service', 'add',
               {
                 'subordinate': true,
                 'charm': 'cs:precise/wordpress-6',
                 'id': 'wordpress',
                 'annotations': {'gui.x': 374.1, 'gui.y': 211.2}
               }]]};
         var properTransform = /translate\((\d+\.?\d*),(\d+\.?\d*)\)/;
         var node, match;

         view.render();

         // Test values from initial load.
         node = view.topo.modules.ServiceModule.getServiceNode('wordpress');
         match = node.getAttribute('transform').match(properTransform);
         match[1].should.eql('100');
         match[2].should.eql('200');

         db.on_delta({ data: tmp_data });
         view.update();

         //On annotation change  position should be updated.
         match = node.getAttribute('transform').match(properTransform);
         match[1].should.eql('374.1');
         match[2].should.eql('211.2');
       });

    it('must be able to render subordinate relation indicators',
       function() {
         var view = new views.environment({
           container: container,
           db: db,
           env: env
         }).render();
         var rel_block = container.one('.sub-rel-count').getDOMNode();

         // Get the contents of the subordinate relation count; YUI cannot
         // get this directly as the node is not an HTMLElement, so use
         // native SVG methods.
         rel_block.firstChild.nodeValue.should.equal('1');
       }
    );

    // Ensure that the zoom controls work
    it('must be able to zoom using controls', function() {
      var view = new views.environment({
        container: container,
        db: db,
        env: env
      }).render();
      // Attach the view to the DOM so that sizes get set properly
      // from the viewport (only available from DOM).
      view.rendered();
      var zoom_in = container.one('#zoom-in-btn'),
          zoom_out = container.one('#zoom-out-btn'),
          module = view.topo.modules.PanZoomModule,
          slider = module.slider,
          svg = container.one('svg g');

      zoom_in.simulate('click');

      var attr = svg.getAttribute('transform');
      // Ensure that, after clicking the zoom in button, that the
      // scale portion of the transform attribute of the svg
      // element has been upped by 0.2.  The transform attribute
      // also contains translate, so test via a regex.
      /scale\(1\.25\)/.test(attr).should.equal(true);

      // Ensure that the slider agrees.
      slider.get('value').should.equal(125);

      // Ensure that zooming via slider sets scale.
      slider.set('value', 150);
      attr = svg.getAttribute('transform');
      /scale\(1\.5\)/.test(attr).should.equal(true);
    });

    // Ensure that sizes are computed properly
    it('must be able to compute rect sizes based on the svg and' +
       ' viewport size',
       function() {
         var view = new views.environment({
           container: container,
           db: db,
           env: env
         }).render();
         // Attach the view to the DOM so that sizes get set properly
         // from the viewport (only available from DOM).
         view.rendered();
         var svg = Y.one('svg');

         parseInt(svg.one('g').getAttribute('height'), 10)
          .should.equal(
         parseInt(svg.getComputedStyle('height'), 10));
         parseInt(svg.one('g').getAttribute('width'), 10)
          .should.equal(
         parseInt(svg.getComputedStyle('width'), 10));
       }
    );

    // Ensure that sizes are computed properly
    it('must be able to compute sizes by the viewport with a minimum',
       function() {
         // The height of a navbar is used in calculating the viewport size,
         // so add a temporary one to the DOM
         var navbar = Y.Node.create('<div class="navbar" ' +
             'style="height:70px;">Navbar</div>');
         Y.one('body').append(navbar);
         var viewport = Y.Node.create('<div id="viewport" ' +
             'style="width:800px;">viewport</div>');
         Y.one('body').append(viewport);
         var view = new views.environment({
           container: container,
           db: db,
           env: env
         }).render();
         // Attach the view to the DOM so that sizes get set properly
         // from the viewport (only available from DOM).
         view.rendered();
         var svg = container.one('svg'),
             canvas = container.one('.topology');
         // We have to hide the canvas so it does not affect our calculations.
         canvas.setStyle('display', 'none');
         parseInt(svg.getAttribute('height'), 10)
          .should.be.above(599);
         // Destroy the navbar
         navbar.remove(true);
         viewport.remove(true);
       }
    );

    // Tests for the service menu.
    it('must be able to toggle the service menu', function(done) {
      var view = new views.environment({
        container: container,
        db: db,
        env: env
      }).render();
      container.all('.service').each(function(node, i) {
        node.after('click', function() {
          view.hasSVGClass(
              node.one('.service-control-panel'),
              'active').should.equal(true);
          container.all('.service-control-panel.active').size()
              .should.equal(1);
        });
      });
      done();
    });

    it('must be able to add a relation from the service menu',
       function() {
         var view = new views.environment({
           container: container,
           getServiceEndpoints: function() {return {};},
           db: db,
           env: env
         }).render();
         var service = container.one('.service'),
             add_rel = container.one('.add-relation'),
             after_evt;

         // Mock endpoints
         var existing = models.getEndpoints;
         models.getEndpoints = function() {
           var endpoints = {},
               serviceName = service.one('.name')
                 .getDOMNode().firstChild.nodeValue,
               nextServiceName = service.next().one('.name')
                 .getDOMNode().firstChild.nodeValue;
           endpoints[nextServiceName] = [
             [
              {
                service: serviceName,
                name: 'relName',
                type: 'relType'
              },
              {
                service: nextServiceName,
                name: 'relName',
                type: 'relType'
              }
             ]
           ];
           return endpoints;
         };

         // Toggle the service menu for the Add Relation button.
         var module = view.topo.modules.RelationModule;
         var sm = view.topo.modules.ServiceModule;

         sm.service_click_actions.toggleServiceMenu(
             d3.select(service.getDOMNode()).datum(),
             sm,
             service);
         // Mock an event object so that d3.mouse does not throw a NPE.
         d3.event = {};
         add_rel.simulate('click');
         container.all('.selectable-service')
               .size()
               .should.equal(2);
         container.all('.dragline')
               .size()
               .should.equal(1);

         // Ensure that mousemove was fired and the dragline moved.
         var x2 = view.topo.vis.select('.dragline').attr('x2');
         var y2 = view.topo.vis.select('.dragline').attr('y2');
         container.one('.topology rect:first-child')
           .simulate('mousemove', { clientX: -1, clientY: -1 });
         view.topo.vis.select('.dragline').attr('x2').should.not.equal(x2);
         view.topo.vis.select('.dragline').attr('y2').should.not.equal(y2);

         // Start the process of adding a relation.
         module.ambiguousAddRelationCheck(
             d3.select(service.next().getDOMNode()).datum(),
             module,
             service.next());
         container.all('.selectable-service').size()
            .should.equal(0);
         // The database is initialized with three relations in beforeEach.
         assert.equal(4, db.relations.size());
         // restore original getEndpoints function
         models.getEndpoints = existing;
       });

    it('must be able to remove a relation between services',
       function() {
         var view = new views.environment({
           container: container,
           db: db,
           env: env}).render();

         var relation = container.one('#relation-0000000001 .rel-label'),
         dialog_btn,
         panel;

         relation.simulate('click');
         panel = Y.one('#rmrelation-modal-panel');

         // There should be a 'remove relation' button and a 'cancel' button
         // on the dialog.
         panel.all('button').size().should.equal(2);

         dialog_btn = panel.one('.btn-danger');
         dialog_btn.simulate('click');
         container.all('.to-remove')
              .size()
              .should.equal(1);
         view.topo.modules.RelationModule.get('rmrelation_dialog').hide();
       });

    it('must not allow removing a subordinate relation between services',
        function() {
         var view = new views.environment({
           container: container,
           db: db,
           env: env}).render();

         // Get a subordinate relation.
         var relation = container.one('#relation-0000000007 .rel-label'),
         dialog_btn,
         panel;

         relation.simulate('click');
         panel = Y.one('#rmsubrelation-modal-panel');

         // There should only be a cancel button on the warning dialog.
         panel.all('button').size().should.equal(1);

         // Clicking cancel will hide the dialog.
         panel.one('button').simulate('click');
         panel.all('button').size().should.equal(0);
        });

    it('should stop creating a relation if the background is clicked',
        function() {
          var db = new models.Database(),
              endpoint_map = {'service-1': {requires: [], provides: []}},
              view = new views.environment(
              { container: container,
                db: db,
                env: env,
                getServiceEndpoints: function() {return endpoint_map;}}),
              service = new models.Service({ id: 'service-1'});

          db.services.add([service]);
          view.render();

          // If the user has clicked on the "Add Relation" menu item...
          var module = view.topo.modules.RelationModule;
          var sm = view.topo.modules.ServiceModule;
          var topo = module.get('component');
          module.startRelation(service);
          assert.isTrue(topo.buildingRelation);
          // ...clicking on the background causes the relation drag to stop.
          sm.backgroundClicked();
          assert.isFalse(topo.buildingRelation);
        });

    it('propagates the getModelURL function to the topology', function() {
      var getModelURL = function() {
        return 'placeholder value';
      };
      var view = new views.environment({
        container: container,
        db: db,
        env: env,
        getModelURL: getModelURL}).render();
      var topoGetModelURL = view.topo.get('getModelURL');
      assert.equal('placeholder value', topoGetModelURL());
    });
  });

  describe('view model support infrastructure', function() {
    var Y, views, models, module, service;

    before(function(done) {
      Y = YUI(GlobalConfig).use(['juju-views', 'juju-models'],
          function(Y) {
            views = Y.namespace('juju.views');
            models = Y.namespace('juju.models');
            done();
          });
    });

    beforeEach(function() {
      service = new models.Service({
        id: 'mediawiki',
        exposed: true});
      module = {
        topology: {
          serviceForBox: function() {return service;}
        }};
    });

    it('must be able to get us nearest connectors',
       function() {
         var b1 = views.BoundingBox(module, service),
         b2 = views.BoundingBox(module, service);

         // raw property access
         b1.x = 0; b1.y = 0;
         b1.w = 100; b1.h = 200;

         // Use pos to set b2
         b2.pos = {x: 200, y: 300, w: 100, h: 200};

         b1.xy.should.eql([0, 0]);
         b2.wh.should.eql([100, 200]);

         b1.getNearestConnector([0, 0]);

         b1.getNearestConnector(b2).should
          .eql(b1.connectors.bottom);

         b2.getNearestConnector(b1).should
          .eql(b2.connectors.top);

         b1.getConnectorPair(b2).should.eql([
           b1.connectors.bottom,
           b2.connectors.top]);
       });

    it('must be able to tell if a point is inside a box', function() {
      var b = views.BoundingBox(module, service);
      b.pos = {x: 100, y: 100, w: 50, h: 50};

      b.containsPoint([125, 125]).should.equal(true);
      b.containsPoint([25, 25]).should.equal(false);
    });

    it('must be able to save and restore old position information',
       function() {
         var b1 = views.BoundingBox(module, service),
             b2 = views.BoundingBox(module, service);

         // raw property access
         b1.x = 0; b1.y = 0;
         b1.w = 100; b1.h = 200;

         // Use pos to set b2
         b2.pos = {x: 200, y: 300, w: 100, h: 200};

         // Update using property.
         b1.x = 100;
         b1.x.should.equal(100);
         b1.px.should.equal(0);

         // Update using position.
         b2.pos = {x: 300};
         b2.x.should.equal(300);
         b2.px.should.equal(200);

       });

    it('must be able to access model attributes', function() {
      var b1 = new views.BoundingBox(module, service);

      b1.modelId.should.equal('service-mediawiki');

      // Properties of the model have mapped to the box.
      b1.id.should.equal('mediawiki');
      b1.exposed.should.equal(true);
    });

    it('must be able to update position data and not touch model data',
       function() {
         var b1 = views.BoundingBox(module, service);
         b1.x = 0; b1.y = 0;
         b1.w = 100; b1.h = 200;
         b1.id.should.equal('mediawiki');

         // X/Y updated, other keys ignored
         b1.pos = {x: 100, y: 100, id: 'blubber'};
         b1.x.should.equal(100);
         b1.id.should.equal('mediawiki');
       });

    it('must be able to map from sequence of models to boundingboxes',
       function() {
         var services = new models.ServiceList();
         services.add([{id: 'mysql'},
                       {id: 'haproxy'},
                       {id: 'memcache'},
                       {id: 'wordpress'}]);

         services.size().should.equal(4);
         var boxes = views.toBoundingBoxes(module, services);
         boxes.mysql.id.should.equal('mysql');
         boxes.wordpress.id.should.equal('wordpress');
       });

    it('must be able to update boxes with new model data',
       function() {
         var services = new models.ServiceList();
         services.add([{id: 'mysql', exposed: false},
                       {id: 'haproxy'},
                       {id: 'memcache'},
                       {id: 'wordpress'}]);

         services.size().should.equal(4);
         var boxes = views.toBoundingBoxes(module, services);
         var mysql = services.getById('mysql');

         boxes.mysql.exposed.should.equal(false);
         mysql.set('exposed', true);

         // The third argument here implies an update.
         views.toBoundingBoxes(module, services, boxes);
         boxes.mysql.exposed.should.equal(true);
       });

    it('must cull removed services from the existing list',
       function() {
         var services = new models.ServiceList();
         services.add([{id: 'mysql', exposed: false},
                       {id: 'memcache'},
                       {id: 'wordpress'}]);
         var existing = {
           'mysql': 1,
           'haproxy': 2, // This entry is stale and will be removed.
           'memcache': 3,
           'wordpress': 4};

         var boxes = views.toBoundingBoxes(module, services, existing);
         // The haproxy is removed from the results since it is no longer in
         // the services list.
         assert.equal(boxes.haproxy, undefined);
       });
  });
})();
