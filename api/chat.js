export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { claudeKey, notionToken, messages, taskContext, dbIds } = req.body;
  const systemPrompt = `You are J.A.R.V.I.S. — a razor-sharp, unapologetically blunt AI chief of staff with dark humor. You manage three business pillars: Personal, Rockee Redd (natural health/wellness brand), and Rise Media. Current task context: ${taskContext}. Database IDs - Personal: ${dbIds.personal}, Rockee Redd: ${dbIds.rockee}, Rise Media: ${dbIds.rise}. You can create tasks in Notion. When the user describes plans or asks you to add tasks, extract actionable tasks and return them in this JSON format at the END of your response: TASKS_JSON:[{"dbId":"database_id_here","taskName":"Task name","priority":"High|Medium|Low","category":"category name","dueDate":"YYYY-MM-DD or null"}]. Only include TASKS_JSON if actually creating tasks. Be sharp, witty, and direct.`;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, system: systemPrompt, messages })
    });
    const data = await response.json();
    let fullText = data.content?.[0]?.text || 'No response.';
    let tasksAdded = false;
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
