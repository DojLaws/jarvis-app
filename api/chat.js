module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const claudeKey = process.env.CLAUDE_API_KEY;
  const notionToken = process.env.NOTION_TOKEN;
  const { messages, taskContext, dbIds } = req.body;
  const systemPrompt = `You are J.A.R.V.I.S. — razor-sharp, blunt AI chief of staff with dark humor. You manage: Personal, Rockee Redd (wellness brand), Rise Media. Current tasks: ${taskContext}. DB IDs - Personal: ${dbIds?.personal}, Rockee Redd: ${dbIds?.rockee}, Rise Media: ${dbIds?.rise}. Keep responses under 60 words. Be direct. If user says they completed/finished a task, mark it done by returning DONE_JSON:[{"pageId":"notion_page_id"}] at the end. If user wants to add tasks, return TASKS_JSON:[{"dbId":"db_id","taskName":"name","priority":"High|Medium|Low","category":"category","dueDate":"YYYY-MM-DD or null"}] at the end. Only include JSON blocks when actually acting on tasks.`;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, system: systemPrompt, messages })
    });
    const data = await response.json();
    let fullText = data.content?.[0]?.text || 'No response.';
    let tasksAdded = false;

    const doneMatch = fullText.match(/DONE_JSON:(\[.*?\])/s);
    if (doneMatch && notionToken) {
      const doneData = JSON.parse(doneMatch[1]);
      fullText = fullText.replace(/DONE_JSON:\[.*?\]/s, '').trim();
      for (const item of doneData) {
        await fetch(`https://api.notion.com/v1/pages/${item.pageId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${notionToken}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: { Status: { select: { name: 'Done' } } } })
        });
      }
      tasksAdded = true;
    }

    const tasksMatch = fullText.match(/TASKS_JSON:(\[.*?\])/s);
    if (tasksMatch && notionToken) {
      const tasksData = JSON.parse(tasksMatch[1]);
      fullText = fullText.replace(/TASKS_JSON:\[.*?\]/s, '').trim();
      for (const task of tasksData) {
        const properties = { Name: { title: [{ text: { content: task.taskName } }] }, Status: { select: { name: 'To Do' } } };
        if (task.priority) properties.Priority = { select: { name: task.priority } };
        if (task.category) properties.Category = { select: { name: task.category } };
        if (task.dueDate) properties['Due Date'] = { date: { start: task.dueDate } };
        await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${notionToken}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent: { database_id: task.dbId }, properties })
        });
      }
      tasksAdded = true;
    }

    return res.status(200).json({ response: fullText, tasksAdded });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
