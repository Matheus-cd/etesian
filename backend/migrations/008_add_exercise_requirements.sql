-- Exercise Requirements: pre-requisites at exercise level, linked to scenarios
-- Red/Lead/Admin create and manage; Blue/Lead mark as fulfilled

CREATE TABLE IF NOT EXISTS exercise_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(30) DEFAULT 'outro' CHECK (category IN ('acesso', 'credencial', 'configuracao', 'software', 'rede', 'outro')),
    fulfilled BOOLEAN DEFAULT FALSE,
    fulfilled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scenario_requirement_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_technique_id UUID NOT NULL REFERENCES exercise_techniques(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES exercise_requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exercise_technique_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_requirements_exercise_id ON exercise_requirements(exercise_id);
CREATE INDEX IF NOT EXISTS idx_scenario_req_links_technique_id ON scenario_requirement_links(exercise_technique_id);
CREATE INDEX IF NOT EXISTS idx_scenario_req_links_requirement_id ON scenario_requirement_links(requirement_id);
