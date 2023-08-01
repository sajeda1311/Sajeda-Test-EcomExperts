if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        this.bindEvents();
        this.form = this.querySelector('form');
        this.form.querySelector('[name=id]').disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      /* This event is triggered when the product-form component will be injected. 
        Usage: If there will be any variant selected then it will set the size variant to 'Unselected'.  
      */
      bindEvents(evt) {
        var url = window.location.search;
        if (url.includes('?variant')) {
          window.location.href = window.location.pathname;
        }
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading-overlay__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        /* Set empty array addItems to push the product items */
        const addItems = [];

        /* Set empty object for addOns to push the addOn item */
        let addOnJSON = {}
        let formNewData = new FormData(this.form);

        /* Set flag to false */
        let addonFlag  = false ;

        /* Get Variants Color and Size to check the condition for bundle functionality  */
        var variantColor = document.querySelector('#color-variant').getAttribute('data-color');
        var varinatSize = document.querySelector('[name="options[Size]"]')?.value;

        /* Check the condition:
          if variant color is selected as a Black and
            variant size is selected as a Medium
          Then set the flag value = true        
        */

        if (variantColor == 'Black' && varinatSize == 'Medium') {
          addonFlag  = true ;
        }

        /* Create random_number variable for bundle functionality */
        var random_number = Math.floor(Math.random() * 100 );
        if(document.querySelector("[data-random]") != null) document.querySelector("[data-random]").remove();

        let node = document.createElement("div");
        node.innerHTML = `<input data-random type = "hidden" name ="properties[randomNumber]" value="${random_number}">`
        this.form.appendChild(node);

        addItems.push(JSON.parse(serializeForm(this.form)));
        random_number = random_number.toString();
        
        /* Check if addonFlage value is true or not
          if its retrun 'true' then the addOn product will be added along with the main product
        */
        if(addonFlag == true){
          addOnJSON = {
           id: parseInt(document.querySelector("[data-addon-variant-id]").getAttribute("data-addon-variant-id")),
           quantity:1,
           properties : {
             randomNumber: random_number,
             productType:"sub_product"
           }
         }
         addItems.push(addOnJSON);
        }
        if (this.cart) {
          let cart = document.createElement("div");
          cart.innerHTML = this.cart.getSectionsToRender().map((section) => section.id)
          this.form.appendChild(cart);

          formNewData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formNewData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }

        /* Add To Cart */
        const body = JSON.stringify({
          items: addItems
        });
        let tempbody = JSON.stringify({
          ...JSON.parse(serializeForm(this.form))
        });
        tempbody = JSON.parse(tempbody);

        fetch(`${routes.cart_add_url}`,  { ...fetchConfig('javascript'), body })
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formNewData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButton.querySelector('span').classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, { source: 'product-form', productVariantId: formNewData.get('id'), cartData: response });
            this.error = false;
            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              this.cart.renderContents(response);
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading-overlay__spinner').classList.add('hidden');
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }
    }
  );
}
