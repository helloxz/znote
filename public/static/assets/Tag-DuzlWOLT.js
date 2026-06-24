import{a6 as so,A as e,u as to,x as p,w as m,y as S,t as I,a3 as io,bd as L,aj as x,N as ho,bo as go,by as D,bv as bo,bz as Co,b2 as vo,z as uo,J as W,_ as h,af as po,G as U,a_ as fo,bk as ko,Z as mo}from"./index.2026051601.js";function Ho(l,i="default",r=[]){const c=l.$slots[i];return c===void 0?r:c()}const xo={closeIconSizeTiny:"12px",closeIconSizeSmall:"12px",closeIconSizeMedium:"14px",closeIconSizeLarge:"14px",closeSizeTiny:"16px",closeSizeSmall:"16px",closeSizeMedium:"18px",closeSizeLarge:"18px",padding:"0 7px",closeMargin:"0 0 0 4px"};function zo(l){const{textColor2:i,primaryColorHover:r,primaryColorPressed:v,primaryColor:c,infoColor:d,successColor:n,warningColor:s,errorColor:t,baseColor:f,borderColor:k,opacityDisabled:b,tagColor:P,closeIconColor:z,closeIconColorHover:u,closeIconColorPressed:o,borderRadiusSmall:a,fontSizeMini:C,fontSizeTiny:g,fontSizeSmall:B,fontSizeMedium:$,heightMini:H,heightTiny:R,heightSmall:M,heightMedium:T,closeColorHover:_,closeColorPressed:E,buttonColor2Hover:j,buttonColor2Pressed:w,fontWeightStrong:O}=l;return Object.assign(Object.assign({},xo),{closeBorderRadius:a,heightTiny:H,heightSmall:R,heightMedium:M,heightLarge:T,borderRadius:a,opacityDisabled:b,fontSizeTiny:C,fontSizeSmall:g,fontSizeMedium:B,fontSizeLarge:$,fontWeightStrong:O,textColorCheckable:i,textColorHoverCheckable:i,textColorPressedCheckable:i,textColorChecked:f,colorCheckable:"#0000",colorHoverCheckable:j,colorPressedCheckable:w,colorChecked:c,colorCheckedHover:r,colorCheckedPressed:v,border:`1px solid ${k}`,textColor:i,color:P,colorBordered:"rgb(250, 250, 252)",closeIconColor:z,closeIconColorHover:u,closeIconColorPressed:o,closeColorHover:_,closeColorPressed:E,borderPrimary:`1px solid ${e(c,{alpha:.3})}`,textColorPrimary:c,colorPrimary:e(c,{alpha:.12}),colorBorderedPrimary:e(c,{alpha:.1}),closeIconColorPrimary:c,closeIconColorHoverPrimary:c,closeIconColorPressedPrimary:c,closeColorHoverPrimary:e(c,{alpha:.12}),closeColorPressedPrimary:e(c,{alpha:.18}),borderInfo:`1px solid ${e(d,{alpha:.3})}`,textColorInfo:d,colorInfo:e(d,{alpha:.12}),colorBorderedInfo:e(d,{alpha:.1}),closeIconColorInfo:d,closeIconColorHoverInfo:d,closeIconColorPressedInfo:d,closeColorHoverInfo:e(d,{alpha:.12}),closeColorPressedInfo:e(d,{alpha:.18}),borderSuccess:`1px solid ${e(n,{alpha:.3})}`,textColorSuccess:n,colorSuccess:e(n,{alpha:.12}),colorBorderedSuccess:e(n,{alpha:.1}),closeIconColorSuccess:n,closeIconColorHoverSuccess:n,closeIconColorPressedSuccess:n,closeColorHoverSuccess:e(n,{alpha:.12}),closeColorPressedSuccess:e(n,{alpha:.18}),borderWarning:`1px solid ${e(s,{alpha:.35})}`,textColorWarning:s,colorWarning:e(s,{alpha:.15}),colorBorderedWarning:e(s,{alpha:.12}),closeIconColorWarning:s,closeIconColorHoverWarning:s,closeIconColorPressedWarning:s,closeColorHoverWarning:e(s,{alpha:.12}),closeColorPressedWarning:e(s,{alpha:.18}),borderError:`1px solid ${e(t,{alpha:.23})}`,textColorError:t,colorError:e(t,{alpha:.1}),colorBorderedError:e(t,{alpha:.08}),closeIconColorError:t,closeIconColorHoverError:t,closeIconColorPressedError:t,closeColorHoverError:e(t,{alpha:.12}),closeColorPressedError:e(t,{alpha:.18})})}const yo={common:so,self:zo},So={color:Object,type:{type:String,default:"default"},round:Boolean,size:String,closable:Boolean,disabled:{type:Boolean,default:void 0}},Io=to("tag",`
 --n-close-margin: var(--n-close-margin-top) var(--n-close-margin-right) var(--n-close-margin-bottom) var(--n-close-margin-left);
 white-space: nowrap;
 position: relative;
 box-sizing: border-box;
 cursor: default;
 display: inline-flex;
 align-items: center;
 flex-wrap: nowrap;
 padding: var(--n-padding);
 border-radius: var(--n-border-radius);
 color: var(--n-text-color);
 background-color: var(--n-color);
 transition: 
 border-color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 line-height: 1;
 height: var(--n-height);
 font-size: var(--n-font-size);
`,[p("strong",`
 font-weight: var(--n-font-weight-strong);
 `),m("border",`
 pointer-events: none;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 border-radius: inherit;
 border: var(--n-border);
 transition: border-color .3s var(--n-bezier);
 `),m("icon",`
 display: flex;
 margin: 0 4px 0 0;
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 font-size: var(--n-avatar-size-override);
 `),m("avatar",`
 display: flex;
 margin: 0 6px 0 0;
 `),m("close",`
 margin: var(--n-close-margin);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),p("round",`
 padding: 0 calc(var(--n-height) / 3);
 border-radius: calc(var(--n-height) / 2);
 `,[m("icon",`
 margin: 0 4px 0 calc((var(--n-height) - 8px) / -2);
 `),m("avatar",`
 margin: 0 6px 0 calc((var(--n-height) - 8px) / -2);
 `),p("closable",`
 padding: 0 calc(var(--n-height) / 4) 0 calc(var(--n-height) / 3);
 `)]),p("icon, avatar",[p("round",`
 padding: 0 calc(var(--n-height) / 3) 0 calc(var(--n-height) / 2);
 `)]),p("disabled",`
 cursor: not-allowed !important;
 opacity: var(--n-opacity-disabled);
 `),p("checkable",`
 cursor: pointer;
 box-shadow: none;
 color: var(--n-text-color-checkable);
 background-color: var(--n-color-checkable);
 `,[S("disabled",[I("&:hover","background-color: var(--n-color-hover-checkable);",[S("checked","color: var(--n-text-color-hover-checkable);")]),I("&:active","background-color: var(--n-color-pressed-checkable);",[S("checked","color: var(--n-text-color-pressed-checkable);")])]),p("checked",`
 color: var(--n-text-color-checked);
 background-color: var(--n-color-checked);
 `,[S("disabled",[I("&:hover","background-color: var(--n-color-checked-hover);"),I("&:active","background-color: var(--n-color-checked-pressed);")])])])]),Po=Object.assign(Object.assign(Object.assign({},D.props),So),{bordered:{type:Boolean,default:void 0},checked:Boolean,checkable:Boolean,strong:Boolean,triggerClickOnClose:Boolean,onClose:[Array,Function],onMouseenter:Function,onMouseleave:Function,"onUpdate:checked":Function,onUpdateChecked:Function,internalCloseFocusable:{type:Boolean,default:!0},internalCloseIsButtonTag:{type:Boolean,default:!0},onCheckedChange:Function}),Bo=mo("n-tag"),Ro=io({name:"Tag",props:Po,slots:Object,setup(l){const i=vo(null),{mergedBorderedRef:r,mergedClsPrefixRef:v,inlineThemeDisabled:c,mergedRtlRef:d,mergedComponentPropsRef:n}=go(l),s=W(()=>{var o,a;return l.size||((a=(o=n?.value)===null||o===void 0?void 0:o.Tag)===null||a===void 0?void 0:a.size)||"medium"}),t=D("Tag","-tag",Io,yo,l,v);fo(Bo,{roundRef:ko(l,"round")});function f(){if(!l.disabled&&l.checkable){const{checked:o,onCheckedChange:a,onUpdateChecked:C,"onUpdate:checked":g}=l;C&&C(!o),g&&g(!o),a&&a(!o)}}function k(o){if(l.triggerClickOnClose||o.stopPropagation(),!l.disabled){const{onClose:a}=l;a&&uo(a,o)}}const b={setTextContent(o){const{value:a}=i;a&&(a.textContent=o)}},P=bo("Tag",d,v),z=W(()=>{const{type:o,color:{color:a,textColor:C}={}}=l,g=s.value,{common:{cubicBezierEaseInOut:B},self:{padding:$,closeMargin:H,borderRadius:R,opacityDisabled:M,textColorCheckable:T,textColorHoverCheckable:_,textColorPressedCheckable:E,textColorChecked:j,colorCheckable:w,colorHoverCheckable:O,colorPressedCheckable:V,colorChecked:K,colorCheckedHover:A,colorCheckedPressed:G,closeBorderRadius:J,fontWeightStrong:Z,[h("colorBordered",o)]:q,[h("closeSize",g)]:Q,[h("closeIconSize",g)]:X,[h("fontSize",g)]:Y,[h("height",g)]:F,[h("color",o)]:oo,[h("textColor",o)]:eo,[h("border",o)]:ro,[h("closeIconColor",o)]:N,[h("closeIconColorHover",o)]:lo,[h("closeIconColorPressed",o)]:co,[h("closeColorHover",o)]:ao,[h("closeColorPressed",o)]:no}}=t.value,y=po(H);return{"--n-font-weight-strong":Z,"--n-avatar-size-override":`calc(${F} - 8px)`,"--n-bezier":B,"--n-border-radius":R,"--n-border":ro,"--n-close-icon-size":X,"--n-close-color-pressed":no,"--n-close-color-hover":ao,"--n-close-border-radius":J,"--n-close-icon-color":N,"--n-close-icon-color-hover":lo,"--n-close-icon-color-pressed":co,"--n-close-icon-color-disabled":N,"--n-close-margin-top":y.top,"--n-close-margin-right":y.right,"--n-close-margin-bottom":y.bottom,"--n-close-margin-left":y.left,"--n-close-size":Q,"--n-color":a||(r.value?q:oo),"--n-color-checkable":w,"--n-color-checked":K,"--n-color-checked-hover":A,"--n-color-checked-pressed":G,"--n-color-hover-checkable":O,"--n-color-pressed-checkable":V,"--n-font-size":Y,"--n-height":F,"--n-opacity-disabled":M,"--n-padding":$,"--n-text-color":C||eo,"--n-text-color-checkable":T,"--n-text-color-checked":j,"--n-text-color-hover-checkable":_,"--n-text-color-pressed-checkable":E}}),u=c?Co("tag",W(()=>{let o="";const{type:a,color:{color:C,textColor:g}={}}=l;return o+=a[0],o+=s.value[0],C&&(o+=`a${U(C)}`),g&&(o+=`b${U(g)}`),r.value&&(o+="c"),o}),z,l):void 0;return Object.assign(Object.assign({},b),{rtlEnabled:P,mergedClsPrefix:v,contentRef:i,mergedBordered:r,handleClick:f,handleCloseClick:k,cssVars:c?void 0:z,themeClass:u?.themeClass,onRender:u?.onRender})},render(){var l,i;const{mergedClsPrefix:r,rtlEnabled:v,closable:c,color:{borderColor:d}={},round:n,onRender:s,$slots:t}=this;s?.();const f=L(t.avatar,b=>b&&x("div",{class:`${r}-tag__avatar`},b)),k=L(t.icon,b=>b&&x("div",{class:`${r}-tag__icon`},b));return x("div",{class:[`${r}-tag`,this.themeClass,{[`${r}-tag--rtl`]:v,[`${r}-tag--strong`]:this.strong,[`${r}-tag--disabled`]:this.disabled,[`${r}-tag--checkable`]:this.checkable,[`${r}-tag--checked`]:this.checkable&&this.checked,[`${r}-tag--round`]:n,[`${r}-tag--avatar`]:f,[`${r}-tag--icon`]:k,[`${r}-tag--closable`]:c}],style:this.cssVars,onClick:this.handleClick,onMouseenter:this.onMouseenter,onMouseleave:this.onMouseleave},k||f,x("span",{class:`${r}-tag__content`,ref:"contentRef"},(i=(l=this.$slots).default)===null||i===void 0?void 0:i.call(l)),!this.checkable&&c?x(ho,{clsPrefix:r,class:`${r}-tag__close`,disabled:this.disabled,onClick:this.handleCloseClick,focusable:this.internalCloseFocusable,round:n,isButtonTag:this.internalCloseIsButtonTag,absolute:!0}):null,!this.checkable&&this.mergedBordered?x("div",{class:`${r}-tag__border`,style:{borderColor:d}}):null)}});export{Ro as N,Ho as g};
