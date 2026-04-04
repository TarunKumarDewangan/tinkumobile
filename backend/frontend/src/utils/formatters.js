/**
 * Formats a date string (YYYY-MM-DD or ISO) to DD/MM/YYYY
 * @param {string|Date|null} date 
 * @returns {string}Formatted date or '-'
 */
export const formatDate = (date) => {
  if (!date) return '-';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date; // Return original if invalid
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    return date;
  }
};
