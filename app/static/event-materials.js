const materialSelect = document.getElementById("material-template");
const quantityInput = document.getElementById("material-quantity");
function updateMaterialQuantity() {
  const option = materialSelect.selectedOptions[0];
  const isItem = option?.dataset.type === "item";
  document.getElementById("material-quantity-label").hidden = !isItem;
  quantityInput.max = isItem ? option.dataset.remaining : "1";
  quantityInput.value = "1";
  document.getElementById("material-quantity-help").textContent = isItem
    ? `${option.dataset.remaining} disponible(s) sur les dates du poste.` : "";
}
materialSelect.addEventListener("change", updateMaterialQuantity);
updateMaterialQuantity();