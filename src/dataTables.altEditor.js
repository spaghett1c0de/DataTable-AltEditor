/**
 * @summary An alternative to DataTables Editor
 * @description A lightweight jQuery plugin that offers full row editing as an alternative to DataTables Editor. Now with Bootstrap 4 support.
 * @version 3.0
 * @file dataTables.altEditor.js
 * @author Kingkode (www.kingkode.com)
 * Modified by: Kasper Olesen (https://github.com/KasperOlesen),
 *              Luca Vercelli (https://github.com/luca-vercelli),
 *              Zack Hable (www.cobaltdevteam.com),
 *              Vincent Liu (https://github.com/spaghett1c0de)
 * @contact www.kingkode.com/contact
 * @contact zack@cobaltdevteam.com
 * @copyright Copyright 2020 Kingkode
 *
 * This source file is free software, available under the following license: MIT license
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.
 */
(function(factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['jquery', 'datatables.net'], function($) {
      return factory($, window, document);
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = function(root, $) {
      if (!root) {
        root = window;
      }

      if (!$ || !$.fn.dataTable) {
        $ = require('datatables.net')(root, $).$;
      }

      return factory($, root, root.document);
    };
  } else {
    // Browser
    factory(jQuery, window, document);
  }
})(function($, window, document, undefined) {

  'use strict';

  const DataTable = $.fn.dataTable;
  let _instance = 0;

  /**
   * altEditor provides modal editing of records for Datatables
   *
   * @class altEditor
   * @constructor
   * @param {object} oTD DataTables settings object
   * @param {object} oConfig Configuration object for altEditor
   */
  const altEditor = function(dt, opts) {
    if (!DataTable.versionCheck || !DataTable.versionCheck('1.10.8')) {
      throw ('Warning: altEditor requires DataTables 1.10.8 or greater');
    }

    // User and defaults configuration object
    this.configuration = $.extend(true, {}, DataTable.defaults.altEditor, altEditor.defaults, opts);

    /** @namespace Settings object which contains customisable information for altEditor instance */
    this.settings = {
      /** @type {DataTable.Api} DataTables' API instance */
      dt: new DataTable.Api(dt),
      /** @type {String} Unique namespace for events attached to the document */
      namespace: '.altEditor' + (_instance++),
    };

    /** @namespace Common and useful DOM elements for the class instance */
    this.dom = {
      /** @type {jQuery} altEditor handle */
      modal: $('<div class="dt-altEditor-handle"/>'),
    };

    /* Constructor logic */
    this._constructor();
  };

  $.extend(altEditor.prototype, {
    /** @private _constructor: Initialise the RowReorder instance */
    _constructor: function() {
      const that = this;
      const dt = this.settings.dt;

      if (dt.settings()[0].oInit.onAddRow) {
        that.onAddRow = dt.settings()[0].oInit.onAddRow;
      }

      if (dt.settings()[0].oInit.onDeleteRow) {
        that.onDeleteRow = dt.settings()[0].oInit.onDeleteRow;
      }

      if (dt.settings()[0].oInit.onEditRow) {
        that.onEditRow = dt.settings()[0].oInit.onEditRow;
      }

      this._setup();

      dt.on('destroy.altEditor', function() {
        dt.off('.altEditor');
        $(dt.table().body()).off(that.s.namespace);
        $(document.body).off(that.s.namespace);
      });
    },

    /** @private _setup: DOM and bind button actions */
    _setup: function() {
      const that = this;
      const dt = this.settings.dt;
      this.random_id = String(Math.random()).replace('.', '');
      const modal_id = `altEditor-modal-${this.random_id}`;
      this.modal_selector = `#${modal_id}`;
      this.language = DataTable.settings.values().next().value.oLanguage.altEditor || {};
      this.language.modalClose = this.language.modalClose || 'Close';
      this.language.edit = this.language.edit || {};
      this.language.edit = {
        title: this.language.edit.title || 'Edit Record',
        button: this.language.edit.button || 'Edit',
      };
      this.language.delete = this.language.delete || {};
      this.language.delete = {
        title: this.language.delete.title || 'Delete Record',
        button: this.language.delete.button || 'Delete',
      };
      this.language.add = this.language.add || {};
      this.language.add = {
        title: this.language.add.title || 'Add Record',
        button: this.language.add.button || 'Add',
      };
      this.language.success = this.language.success || 'Success!';
      this.language.error = this.language.error || {};
      this.language.error = {
        message: this.language.error.message || 'There was an unknown error!',
        label: this.language.error.label || 'Error!',
        responseCode: this.language.error.responseCode || 'Response code: ',
        required: this.language.error.required || 'Field is required',
        unique: this.language.error.unique || 'Duplicated field',
      };
      const modal = `
          <div class="modal fade" id="${modal_id}" tabindex="-1" role="dialog">
            <div class="modal-dialog">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title"></h5>
                  <button type="button" class="close" data-dismiss="modal" 
                          aria-label="${this.language.modalClose}">
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer"></div>
              </div>
            </div>
          </div>`;
      // Add modal
      $('body').append(modal);

      // Add 'Edit' button
      if (dt.button('edit:name')) {
        dt.button('edit:name').action(function(e, dt, node, config) {
          that._openEditModal();

          $(`#altEditor-edit-form-${that.random_id}`).off('submit').on('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            that._editRowData();
          });
        });
      }

      // Add 'Delete' button
      if (dt.button('delete:name')) {
        dt.button('delete:name').action(function(e, dt, node, config) {
          that._openDeleteModal();

          $(`#altEditor-delete-form-${that.random_id}`).off('submit').on('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            that._deleteRow();
          });
        });
      }

      // Add 'Add' button
      if (dt.button('add:name')) {
        dt.button('add:name').action(function(e, dt, node, config) {
          that._openAddModal();

          $(`#altEditor-add-form-${that.random_id}`).off('submit').on('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            that._addRowData();
          });
        });
      }

      // Bind 'unique' error messages
      $(this.modal_selector).on('input', '[data-unique]', function(elm) {
        const $target = $(elm.target);
        if ($target.attr('data-unique') === null || $target.attr('data-unique') === 'false') {
          return;
        }

        // Reset custom validation
        elm.target.setCustomValidity('');

        // Go through each item in this column and find the selected item
        let selectedCellData = null;
        if (dt.row({selected: true}).index() !== null) {
          selectedCellData = dt.cell(dt.row({selected: true}).index(),
              dt.column(`th:contains('${$target.attr('name')}')`).index()).data();
        }

        const colData = dt.columns(`th:contains('${$target.attr('name')}')`).data()[0];
        colData.forEach(element => {
          // Modal title is used to determine whether it's add or edit modal
          const modalTitle = $(that.modal_selector).find('h5.modal-title').text().trim();
          // If the element is in the column and it's not the selected one then it's not unique
          // (case insensitive)
          const curValueCaseInsensitive = (typeof $target.val() === 'string')
              ? $target.val().toUpperCase().trim() : $target.val();
          const elementCaseInsensitive = (typeof element === 'string')
              ? element.toUpperCase().trim() : element;
          if (modalTitle === 'Add Record') {
            if (curValueCaseInsensitive === elementCaseInsensitive) {
              elm.target.setCustomValidity(that.language.error.unique);
            }
          } else if (modalTitle === 'Edit Record') {
            const selectedCellCaseInsensitive = (typeof selectedCellData === 'string')
                ? String(selectedCellData).toUpperCase().trim() : selectedCellData;
            if (curValueCaseInsensitive === elementCaseInsensitive
                && curValueCaseInsensitive !== selectedCellCaseInsensitive) {
              elm.target.setCustomValidity(that.language.error.unique);
            }
          }
        });
      });

      // Add 'Refresh' button
      if (this.settings.dt.button('refresh:name')) {
        this.settings.dt.button('refresh:name').action(function(e, dt, node, config) {
          if (dt.ajax && dt.ajax.url()) {
            dt.ajax.reload();
          }
        });
      }
    },

    /** @private Open Edit Modal for selected row */
    _openEditModal: function() {
      const columnDefs = this.completeColumnDefs();
      this.createDialog(columnDefs, this.language.edit.title, this.language.edit.button,
          this.language.modalClose, 'editRowBtn', 'altEditor-edit-form');

      const adata = this.settings.dt.rows({selected: true});
      const $selector = $(this.modal_selector);
      columnDefs.forEach(column => {
        const arrIndex = '[\'' + column.name.toString().split('.').join('\'][\'') + '\']';
        const selectedValue = this._quoteattr(eval('adata.data()[0]' + arrIndex));
        const $jquerySelector = column.datetimepicker
            ? $selector.find(`#${column.name.toString().replace(/\./g, '\\.')}DateInput`)
            : $selector.find(`#${column.name.toString().replace(/\./g, '\\.')}`);
        $jquerySelector.val(selectedValue);
        if (column.selectpicker) {
          $('.selectpicker').selectpicker('refresh'); // Refresh bootstrap-select
        }
      });

      $(`${this.modal_selector} input`)[0].focus();
      $selector.trigger('alteditor:some_dialog_opened').trigger('alteditor:edit_dialog_opened');
    },

    // Callback for "Edit" button
    _editRowData: function() {
      const that = this;

      // Complete new row data
      const rowDataArray = {};

      // Getting the inputs from the edit-modal
      const $editForm = $(`form[name="altEditor-edit-form-${this.random_id}"] *`);
      $editForm.filter(':input[type!="file"]').each(function(i) {
        rowDataArray[$(this).attr('id')] = $(this).val();
      });

      //Getting the textArea from the modal
      $editForm.filter('textarea').each(function(i) {
        rowDataArray[$(this).attr('id')] = $(this).val();
      });

      //Getting Files from the modal
      let numFilesQueued = 0;
      $editForm.filter(':input[type="file"]').each(function(i) {
        if ($(this).prop('files')[0]) {
          ++numFilesQueued;
          that.getBase64($(this).prop('files')[0], function(filecontent) {
            rowDataArray[$(this).attr('id')] = filecontent;
            --numFilesQueued;
          });
        }
      });

      const checkFilesQueued = function() {
        if (numFilesQueued === 0) {
          that.onEditRow(that,
              rowDataArray,
              function(data, b, c, d, e) { that._editRowCallback(data, b, c, d, e); },
              function(data) { that._errorCallback(data); });
        } else {
          console.log('Waiting for file base64-decoding...');
          setTimeout(checkFilesQueued, 1000);
        }
      };

      checkFilesQueued();
    },

    /** @private Open Delete Modal for selected row */
    _openDeleteModal: function() {
      const that = this;
      const dt = this.settings.dt;
      const adata = dt.rows({selected: true});
      const formName = `altEditor-delete-form-${this.random_id}`;

      // Building delete-modal
      let data = '';
      const columnDefs = this.completeColumnDefs();
      columnDefs.forEach(column => {
        if (column.type.indexOf('hidden') >= 0) {
          data += `<input type="hidden" id="${column.title}" 
                          value="${adata.data()[0][column.name]}">`;
        } else if (column.type.indexOf('file') < 0) {
          data += `
              <div class="row mb-0">
                <div class="col-12">
                  <label for="${that._quoteattr(column.name)}">
                    ${column.title}:&nbsp
                  </label>
                  <input type="hidden" id="${that._quoteattr(column.title)}" 
                         name="${that._quoteattr(column.title)}" 
                         placeholder="${that._quoteattr(column.title)}" 
                         style="overflow:hidden"  class="form-control" 
                         value="${that._quoteattr(adata.data()[0][column.name])}">
                    ${adata.data()[0][column.name]}
                  </input>
                </div>
              </div>`;
        }
      });

      const $selector = $(this.modal_selector);
      $selector.on('show.bs.modal', function() {
        const btns = `
            <button type="button" data-content="remove" class="btn btn-secondary"
                    data-dismiss="modal">${that.language.modalClose}</button>
            <button type="submit" data-content="remove" class="btn btn-danger" 
                    id="deleteRowBtn">${that.language.delete.button}</button>`;
        $selector.find('.modal-title').html(that.language.delete.title);
        $selector.find('.modal-body').html(data);
        $selector.find('.modal-footer').html(btns);
        const modalContent = $selector.find('.modal-content');
        if (modalContent.parent().is('form')) {
          modalContent.parent().attr('name', formName);
          modalContent.parent().attr('id', formName);
        } else {
          modalContent.wrap(`<form name="${formName}" id="${formName}" role="form"></form>`);
        }
      });

      $selector.modal('show');
      $(`${this.modal_selector} input`)[0].focus();
      $selector.trigger('alteditor:some_dialog_opened').trigger('alteditor:delete_dialog_opened');
    },

    // Callback for 'Delete' button
    _deleteRow: function() {
      const that = this;
      const dt = this.settings.dt;
      const jsonDataArray = {};
      const adata = dt.rows({selected: true});

      // Getting the IDs and Values of the table row
      dt.context[0].aoColumns.forEach(column => {
        // .data is the attribute name, if any; .idx is the column index, so it should always exists
        let name;
        if (column.data) {
          name = column.data;
        } else if (column.mData) {
          name = column.mData;
        } else {
          name = column.idx;
        }
        jsonDataArray[name] = adata.data()[0][name];
      });

      that.onDeleteRow(that,
          jsonDataArray,
          function(data) { that._deleteRowCallback(data); },
          function(data) { that._errorCallback(data); });
    },

    /** @private Open Add Modal for selected row */
    _openAddModal: function() {
      const columnDefs = this.completeColumnDefs();
      this.createDialog(columnDefs, this.language.add.title, this.language.add.button,
          this.language.modalClose, 'addRowBtn', 'altEditor-add-form');

      $(`${this.modal_selector} input`)[0].focus();
      $(this.modal_selector)
          .trigger('alteditor:some_dialog_opened')
          .trigger('alteditor:add_dialog_opened');
    },

    // Complete DataTable.context[0].aoColumns with default values
    completeColumnDefs: function() {
      const columnDefs = [];
      const columns = this.settings.dt.context[0].aoColumns;
      columns.forEach((column, index) => {
        columnDefs[index] = {
          title: column.sTitle,
          name: (column.data ? column.data : column.mData),
          type: (column.type ? column.type : 'text'),
          rows: (column.rows ? column.rows : '5'),
          cols: (column.cols ? column.cols : '30'),
          options: (column.options ? column.options : []),
          readonly: (column.readonly ? column.readonly : false),
          disabled: (column.disabled ? column.disabled : false),
          required: (column.required ? column.required : false),
          msg: (column.errorMsg ? column.errorMsg : ''),        // FIXME no more used
          hoverMsg: (column.hoverMsg ? column.hoverMsg : ''),
          pattern: (column.pattern ? column.pattern : '.*'),
          special: (column.special ? column.special : ''),
          unique: (column.unique ? column.unique : false),
          uniqueMsg: (column.uniqueMsg ? column.uniqueMsg : ''),        // FIXME no more used
          maxLength: (column.maxLength ? column.maxLength : false),
          minLength: (column.minLength ? column.minLength : false),
          multiple: (column.multiple ? column.multiple : false),
          selectpicker: (column.selectpicker ? column.selectpicker : false),
          datepicker: (column.datepicker ? column.datepicker : false),
          datetimepicker: (column.datetimepicker ? column.datetimepicker : false),
          editorOnChange: (column.editorOnChange ? column.editorOnChange : null),
        };
      });

      return columnDefs;
    },

    /**
     * Create both Edit and Add dialogs
     * @param columnDefs - returned by completeColumnDefs()
     * @param title - modal title
     * @param buttonCaption - form submit button text (Add, Edit, or Delete)
     * @param closeCaption - modal close button text (Close)
     * @param buttonId - unique button id
     * @param formName - name of the form
     */
    createDialog: function(columnDefs, title, buttonCaption, closeCaption, buttonId, formName) {
      let data = '';
      columnDefs.forEach(column => {
        // Handle hidden fields
        if (column.type.indexOf('hidden') >= 0) {
          data += `<input type="hidden" id="${column.name}">`;
        } else {
          // Handle fields that are visible to the user
          data += `<div class="form-group row mb-0" 
                        id="alteditor-row-${this._quoteattr(column.name)}">`;
          data += `<label class="col-sm-3 col-form-label text-left text-sm-right" for="${column.name}">
                     ${column.title}:</label>`;
          data += '<div class="col-sm-9">';

          // Adding readonly fields
          if (column.type.indexOf('readonly') >= 0) {
            // type=readonly is deprecated, kept for backward compatibility
            data += `
                <input type="text" id="${this._quoteattr(column.name)}"
                       name="${this._quoteattr(column.title)}"
                       placeholder="${this._quoteattr(column.title)}"
                       style="overflow: hidden;" class="form-control" value="" readonly>`;
          } else if (column.datetimepicker) {
            // Adding datetimepicker fields
            data += `
                <div id="${this._quoteattr(column.name)}" class="input-group date"
                     data-target-input="nearest">
                  <input id="${this._quoteattr(column.name)}DateInput" type="text"
                         class="form-control datetimepicker-input"
                         data-target="#${this._quoteattr(column.name)}"
                         ${(column.readonly ? ' readonly ' : '')}
                         ${(column.disabled ? ' disabled ' : '')}
                         ${(column.required ? ' required ' : '')}>
                  <span class="input-group-append" data-target="#${this._quoteattr(column.name)}"
                        data-toggle="datetimepicker">
                    <span class="input-group-text fas fa-calendar-alt"></span>
                  </span>
                </div>`;
          } else if (column.type.indexOf('select') >= 0) {
            // Adding select fields
            let options = '';
            const optionsArray = Object.entries(column.options);
            optionsArray.forEach(option => {
              options += `<option value="${this._quoteattr(option[0])}">${option[1]}</option>`;
            });
            data += `
                <select class="form-control ${(column.selectpicker ? 'selectpicker' : '')}"
                        id="${this._quoteattr(column.name)}" name="${this._quoteattr(column.title)}" 
                        title="Select an option"
                        ${(column.multiple ? ' multiple ' : '')}
                        ${(column.readonly ? ' readonly ' : '')}
                        ${(column.disabled ? ' disabled ' : '')}
                        ${(column.required ? ' required ' : '')}>${options}</select>`;
          } else if (column.type.indexOf('textarea') >= 0) {
            // Adding textarea
            data += `
                <textarea id="${this._quoteattr(column.name)}" 
                          name="${this._quoteattr(column.title)}"
                          rows="${this._quoteattr(column.rows)}" 
                          cols="${this._quoteattr(column.cols)}">
                </textarea>`;
          } else {
            // Adding text inputs and error labels, but also new HTML5 types (email, color, ...)
            data += `
                <input type="${this._quoteattr(column.type)}" id="${this._quoteattr(column.name)}"
                       pattern="${this._quoteattr(column.pattern)}" 
                       title="${this._quoteattr(column.hoverMsg)}"
                       name="${this._quoteattr(column.title)}"
                       placeholder="${this._quoteattr(column.title)}"
                       data-special="${this._quoteattr(column.special)}"
                       data-errorMsg="${this._quoteattr(column.msg)}"
                       data-uniqueMsg="${this._quoteattr(column.uniqueMsg)}"
                       data-unique="${column.unique}"
                       ${(column.readonly ? ' readonly ' : '')}
                       ${(column.disabled ? ' disabled ' : '')}
                       ${(column.required ? ' required ' : '')}
                       ${(column.maxLength === false ? '' : ` maxlength="${column.maxLength}" `)}
                       ${(column.minLength === false ? '' : ` maxlength="${column.minLength}" `)}
                       style="overflow: hidden;" class="form-control" value="">`;
          }

          data += `<label id="${this._quoteattr(column.name)}label" class="errorLabel"></label>`;
          data += '</div><div style="clear: both;"></div></div>';
        }
      });

      formName = [formName, this.random_id].join('-');
      const $selector = $(this.modal_selector);
      $selector.on('show.bs.modal', function() {
        const btns = `
            <button type="button" data-content="remove" data-dismiss="modal"  
                    class="btn btn-secondary">${closeCaption}</button>
            <button type="submit" data-content="remove" form="${formName}" id="${buttonId}"
                    class="btn btn-primary">${buttonCaption}</button>`;
        $selector.find('.modal-title').html(title);
        $selector.find('.modal-body').html(data);
        $selector.find('.modal-footer').html(btns);
        const $modalContent = $selector.find('.modal-content');
        if ($modalContent.parent().is('form')) {
          $modalContent.parent().attr('name', formName);
          $modalContent.parent().attr('id', formName);
        } else {
          $modalContent.wrap(`<form name="${formName}" id="${formName}" role="form"></form>`);
        }
      });

      $selector.modal('show');
      $(`${this.modal_selector} input`)[0].focus();

      // Enable bootstrap-select, datepicker and datetimepicker
      const that = this;
      columnDefs.forEach(column => {
        if (column.selectpicker) {
          // Require bootstrap-select plugin
          $selector.find(`#${column.name}`).selectpicker(column.selectpicker);
        } else if (column.datepicker) {
          // Require bootstrap-datepicker plugin
          $selector.find(`#${column.name}`).datepicker(column.datepicker);
        } else if (column.datetimepicker) {
          // Require datetimepicker plugin
          $selector.find(`#${column.name}`).datetimepicker(column.datetimepicker);
        }
        // custom onchange triggers
        if (column.editorOnChange) {
          const f = column.editorOnChange; // FIXME what if more than 1 editorOnChange ?
          $selector.find(`#${column.name}`).on('change', function(elm) {
            f(elm, that);
          });
        }
      });
    },

    // Callback for "Add" button
    _addRowData: function() {
      const rowDataArray = {};
      // Getting the inputs from the modal
      const $editorAddForm = $(`form[name="altEditor-add-form-${this.random_id}"] *`);
      $editorAddForm.filter(':input[type!="file"]').each(function(i) {
        rowDataArray[$(this).attr('id')] = $(this).val();
      });

      //Getting the textArea from the modal
      $editorAddForm.filter('textarea').each(function(i) {
        rowDataArray[$(this).attr('id')] = $(this).val();
      });

      const that = this;
      let numFilesQueued = 0;
      //Getting Files from the modal
      $editorAddForm.filter(':input[type="file"]').each(function(i) {
        if ($(this).prop('files')[0]) {
          ++numFilesQueued;
          that.getBase64($(this).prop('files')[0], function(filecontent) {
            rowDataArray[$(this).attr('id')] = filecontent;
            --numFilesQueued;
          });
        }
      });

      const checkFilesQueued = function() {
        if (numFilesQueued === 0) {
          that.onAddRow(that,
              rowDataArray,
              function(data) { that._addRowCallback(data); },
              function(data) { that._errorCallback(data); });
        } else {
          console.log('Waiting for file base64-decoding...');
          setTimeout(checkFilesQueued, 1000);
        }
      };

      checkFilesQueued();
    },

    // Called after a row has been deleted on the server
    _deleteRowCallback: function(response, status, more) {
      const selector = this.modal_selector;
      $(`${selector} .modal-body .alert`).remove();

      const message = `
          <div class="alert alert-success" role="alert">
            <strong>${this.language.success}</strong>
          </div>`;
      $(`${selector} .modal-body`).append(message);

      const dt = this.settings.dt;
      dt.row({selected: true}).remove();
      dt.draw('page');

      // Disabling submit button
      const $selector = $(`div${selector}`);
      $selector.find('button#addRowBtn').prop('disabled', true);
      $selector.find('button#editRowBtn').prop('disabled', true);
      $selector.find('button#deleteRowBtn').prop('disabled', true);
    },

    // Called after a row has been inserted on the server
    _addRowCallback: function(response, status, more) {
      // TODO should honor dt.ajax().dataSrc

      const data = (typeof response === 'string') ? JSON.parse(response) : response;
      const selector = this.modal_selector;
      $(`${selector} .modal-body .alert`).remove();

      const message = `
          <div class="alert alert-success" role="alert">
            <strong>${this.language.success}</strong>
          </div>`;
      $(`${selector} .modal-body`).append(message);

      this.settings.dt.row.add(data).draw(false);  // TODO: Does this draw a new row?

      // Disabling submit button
      const $selector = $(`div${selector}`);
      $selector.find('button#addRowBtn').prop('disabled', true);
      $selector.find('button#editRowBtn').prop('disabled', true);
      $selector.find('button#deleteRowBtn').prop('disabled', true);
    },

    // Called after a row has been updated on the server
    _editRowCallback: function(response, status, more) {
      //TODO should honor dt.ajax().dataSrc

      const data = (typeof response === 'string') ? JSON.parse(response) : response;
      const selector = this.modal_selector;
      $(`${selector} .modal-body .alert`).remove();

      const message = `
          <div class="alert alert-success" role="alert">
            <strong>${this.language.success}</strong>
          </div>`;
      $(`${selector} .modal-body`).append(message);

      const dt = this.settings.dt;
      dt.row({selected: true}).data(data);
      dt.draw('page');

      // Disabling submit button
      const $selector = $(`div${selector}`);
      $selector.find('button#addRowBtn').prop('disabled', true);
      $selector.find('button#editRowBtn').prop('disabled', true);
      $selector.find('button#deleteRowBtn').prop('disabled', true);
    },

    // Called after AJAX server returned an error
    _errorCallback: function(response, status, more) {
      const error = response;
      const selector = this.modal_selector;
      $(`${selector} .modal-body .alert`).remove();

      let errStr = this.language.error.message;
      if (error.responseJSON && error.responseJSON.errors) {
        errStr = '';
        for (const error of error.responseJSON.errors) {
          errStr += error[0];
        }
      }
      const message = `
          <div class="alert alert-danger" role="alert">
            <strong>${this.language.error.label}</strong>
            ${error.status === null
          ? ''
          : `${this.language.error.responseCode}${error.status} ${errStr}`}
          </div>`;

      $(`${selector} .modal-body`).append(message);
    },

    // Default callback for insertion: mock webservice, always success.
    onAddRow: function(altEditor, rowdata, success, error) {
      console.log('Missing AJAX configuration for INSERT');
      success(rowdata);
    },

    // Default callback for editing: mock webservice, always success.
    onEditRow: function(altEditor, rowdata, success, error) {
      console.log('Missing AJAX configuration for UPDATE');
      success(rowdata);
    },

    // Default callback for deletion: mock webservice, always success.
    onDeleteRow: function(altEditor, rowdata, success, error) {
      console.log('Missing AJAX configuration for DELETE');
      success(rowdata);
    },

    // Dynamically reload options in SELECT menu
    reloadOptions: function($select, options) {
      const oldValue = $select.val();
      $select.empty(); // remove old options
      if (options.length > 0) {
        // array-style select or bootstrap-select
        $.each(options, function(key, value) {
          $select.append($('<option></option>').attr('value', value).text(value));
        });
      } else {
        // object-style select or select2
        $.each(options, function(key, value) {
          $select.append($('<option></option>').attr('value', value).text(key));
        });
      }
      $select.val(oldValue); // if still present, of course
      $select.trigger('change');
      $('.selectpicker').selectpicker('refresh'); // Refresh bootstrap-select
    },

    /**
     * Convert file to Base 64 form
     * @see https://stackoverflow.com/questions/36280818
     */
    getBase64: function(file, onSuccess, onError) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function() {
        if (onSuccess) {
          onSuccess(reader.result);
        }
      };
      reader.onerror = function(error) {
        if (onError) {
          onError(error);
        }
      };
    },

    /**
     * @private Sanitize input for use in HTML
     * @param unsanitizedInput
     * @param preserveCR
     * @returns {string}
     */
    _quoteattr: function(unsanitizedInput, preserveCR) {
      if (unsanitizedInput === null) {
        return '';
      }
      preserveCR = preserveCR ? '&#13;' : '\n';
      if (Array.isArray(unsanitizedInput)) {
        // for MULTIPLE SELECT
        const newArray = [];
        unsanitizedInput.forEach(element => {
          newArray.push(element);
        });
        return newArray;
      }
      return ('' + unsanitizedInput)  // Forces the conversion to string
          .replace(/&/g, '&amp;')  // This MUST be the 1st replacement
          .replace(/'/g, '&apos;')  //The 4 other predefined entities, required
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\r\n/g, preserveCR)  // Must be before the next replacement
          .replace(/[\r\n]/g, preserveCR);
    },
  });

  /**
   * @static altEditor version
   * @type String
   */
  altEditor.version = '3.0';

  /**
   * altEditor defaults
   * @namespace
   */
  altEditor.defaults = {
    /** @type {Boolean} Ask user what they want to do, even for a single option */
    alwaysAsk: false,

    /** @type {string|null} What will trigger a focus */
    focus: null, // focus, click, hover

    /** @type {column-selector} Columns to provide auto fill for */
    columns: '', // all

    /** @type {boolean|null} Update the cells after a drag */
    update: null, // false is editor given, true otherwise

    /** @type {DataTable.Editor} Editor instance for automatic submission */
    editor: null,
  };

  /**
   * Classes used by altEditor that are configurable
   * @namespace
   */
  altEditor.classes = {
    /** @type {String} Class used by the selection button */
    btn: 'btn',
  };

  // Attach a listener to the document which listens for DataTables initialisation events
  // so we can automatically initialize
  $(document).on('preInit.dt.altEditor', function(e, settings, json) {
    if (e.namespace !== 'dt') {
      return;
    }

    const init = settings.oInit.altEditor;
    const defaults = DataTable.defaults.altEditor;

    if (init || defaults) {
      const opts = $.extend({}, init, defaults);
      if (init !== false) {
        // e is a jQuery event object
        // e.target is the underlying jQuery object, e.g. $('#mytable')
        // so that you can retrieve the altEditor object later
        e.target.altEditor = new altEditor(settings, opts);
      }
    }
  });

  // Alias for access
  DataTable.altEditor = altEditor;
  return altEditor;
});
