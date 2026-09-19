(function(){
  const cfg = window.NHA_SI_ECH_CONFIG || {};
  const connect = document.querySelector('[data-connect-tiktok]');
  const publish = document.querySelector('[data-publish]');
  const consent = document.querySelector('[data-consent]');
  const status = document.querySelector('[data-status]');

  if (connect) {
    const url = cfg.tiktokOAuthStartUrl || "";
    if (!url || url.startsWith("REPLACE_")) {
      connect.addEventListener("click", function(e){
        e.preventDefault();
        alert("TikTok OAuth chưa được nối. Hãy cấu hình URL webhook n8n trong assets/config.js.");
      });
    } else {
      connect.href = url;
    }
  }

  if (publish && consent) {
    publish.disabled = !consent.checked;
    consent.addEventListener("change", function(){
      publish.disabled = !consent.checked;
      if (status) status.textContent = consent.checked
        ? "Sẵn sàng gửi sau khi tài khoản TikTok được kết nối."
        : "Cần xác nhận của người dùng trước khi gửi nội dung.";
    });
    publish.addEventListener("click", function(){
      if (!consent.checked) return;
      alert("Màn hình demo. Hãy nối API publish qua n8n trước khi gửi App Review.");
    });
  }
})();