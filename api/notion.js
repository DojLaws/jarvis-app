module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, apiKey, dbId, pageId, action, taskName, priority, category, dueDate } = req.body;
  try {
    if (action === 'queryDatabase') {
      const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token||apiKey}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: { property: 'Status', select: { does_not_equal: 'Done' } }, sorts: [{ property: 'Due Date', direction: 'ascending' }] })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
    if (action === 'updatePage') {
      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token||apiKey}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: { Status: { select: { name: 'Done' } } } })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
    if (action === 'createPage') {
      const properties = { Name: { title: [{ text: { content: taskName } }] }, Status: { select: { name: 'To Do' } } };
      if (priority) properties.Priority = { select: { name: priority } };
      if (category) properties.Category = { select: { name: category } };
      if (dueDate) properties['Due Date'] = { date: { start: dueDate } };
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token||apiKey}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent: { database_id: dbId }, properties })
      });
      const data = await response.json();
      return res.status(200).json(data);
    }
    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
