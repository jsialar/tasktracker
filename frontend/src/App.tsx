import { NavLink, Route, Routes } from 'react-router';
import { CreateTaskPage } from './pages/CreateTaskPage.tsx';
import { TaskListPage } from './pages/TaskListPage.tsx';

export function App() {
  return (
    <>
      <header className="app-header">
        <h1>Task Assignment</h1>
        <nav>
          <NavLink to="/" end>
            Tasks
          </NavLink>
          <NavLink to="/new">Create Task</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<TaskListPage />} />
          <Route path="/new" element={<CreateTaskPage />} />
        </Routes>
      </main>
    </>
  );
}
